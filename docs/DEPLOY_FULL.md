# Deploying the `full` profile on Google Cloud (author only)

Written for the author. **The agent did not deploy, did not call Google Cloud, did not create or read a bucket and did not upload or download
anything.** Every `<...>` is a placeholder for decision 8 (region, bucket, prefix, readers, approved sequences). Statements about Google Cloud
products are from memory and marked **[unverified]**: confirm each in the current Google Cloud documentation before running it. Costs,
free-tier limits and egress charges are **[unverified]**: read the current Google Cloud pricing pages yourself; nothing here quotes them.

The public demo does **not** depend on any of this: it is the static `edu` bundle (`frontend/`), which needs no server, login or cloud.

## 0. Before anything: the decisions that gate real data

| Decision | Blocks | Safe default in the code |
|---|---|---|
| 4: SPHEREx/IRSA data terms, acknowledgement wording, may copies be kept in a bucket | uploading originals at all | real-data path off |
| 1: may real pixels be served, for which sequences | `SERVE_PIXELS=true` | `false`: numbers only |
| 8: region, bucket name, prefix, who reads, approved sequences | every step below | placeholders, empty allow-list |

Until 4 is answered, keep the bucket private and `REAL_DATA_ENABLED=false`.

## 1. The three stages and where each runs

| Stage | Code | Runs where | Writes |
|---|---|---|---|
| Archive retrieval | `python -m blink.archive.retrieve` | author's machine (or a one-off job) | `fields/<f>/originals/`, `manifest.json` |
| Scientific processing | `python -m blink.processing.job` (needs NumPy, Astropy, Node) | author's machine | `fields/<f>/products/<seq>/` |
| Storage + serving | `Dockerfile` (FastAPI, read-only routes) | Cloud Run [unverified: the natural fit for one stateless container] | nothing |

Reading a bucket is only the last stage. Without retrieval and processing there is nothing approved to serve.

## 2. Project, bucket, identities (placeholders)

```bash
gcloud config set project spherex-blink
# A PRIVATE bucket: uniform bucket-level access, public access prevention on. [unverified: flag names; check `gcloud storage buckets create --help`]
gcloud storage buckets create gs://<bucket> --location=<region> --uniform-bucket-level-access --public-access-prevention
# The identity the server runs as: READ-ONLY on that bucket (least privilege).
gcloud iam service-accounts create blink-api --display-name="SPHEREx Blink API (read-only)"
gcloud storage buckets add-iam-policy-binding gs://<bucket> --member=serviceAccount:blink-api@spherex-blink.iam.gserviceaccount.com --role=roles/storage.objectViewer
```

Write access is needed only by whoever runs retrieval and processing (the author's own login through Application Default Credentials, or a
separate job identity with `roles/storage.objectCreator` / `objectUser` on the prefix [unverified: role names]). **Never create a key file for
either identity**, never put one in the repository, the container, chat or logs. The code reads no key setting on purpose.

## 3. Products: two ways to get them into the bucket

**A. Process locally, then copy the folder** (simplest; Node and Astropy stay on the author's machine):

```bash
export BLINK_PROFILE=full SPHEREX_DATA_DIR=backend/data/store          # git-ignored
# (a) originals already on disk -> manifest
backend/.venv/bin/python -m blink.manifest --data-dir backend/data/store --field <field-id> --ra <deg> --dec <deg> --fov 5
# (b) or fetch them: write plan.json (format in blink/archive/retrieve.py), add the sequence to backend/approved_sequences.json, then
backend/.venv/bin/python -m blink.archive.retrieve --plan plan.json                       # dry run: prints the files
backend/.venv/bin/python -m blink.archive.retrieve --plan plan.json --confirm-download    # only after deciding the download is allowed
# process (resampling and masks reused unchanged from 3.0; candidates by movers-2 through Node)
backend/.venv/bin/python -m blink.processing.job --field <field-id> --sequence <field-id>-d2 --detector D2
# copy to the bucket (originals only if decision 4 allows keeping copies there)
gcloud storage cp -r backend/data/store/fields/<field-id>/products gs://<bucket>/<prefix>/fields/<field-id>/
gcloud storage cp backend/data/store/fields/<field-id>/manifest.json gs://<bucket>/<prefix>/fields/<field-id>/
```

**B. Write straight to the bucket**: the same commands with `GCS_BUCKET=<bucket> GCS_PREFIX=<prefix>` instead of `SPHEREX_DATA_DIR`, logged in
with `gcloud auth application-default login` as an identity that may write.

## 4. Approve the sequence

Edit `backend/approved_sequences.json` (it ships empty):

```json
{ "approved": [ { "sequenceId": "<field-id>-d2", "fieldId": "<field-id>", "approvedBy": "<author>", "approvedOn": "<date>", "termsChecked": false } ] }
```

`termsChecked: true` only after decision 4. A real sequence is served only when `REAL_DATA_ENABLED=true` **and** `termsChecked` is true **and**
its product is in the store. Anything else is a 404.

## 5. Build and deploy the container

```bash
docker build -t <region>-docker.pkg.dev/spherex-blink/<repo>/blink-api:<tag> .
docker run --rm -p 8080:8080 -e BLINK_PROFILE=edu <image>              # local check: node scripts/smoke_test_full.mjs http://127.0.0.1:8080 --expect-profile edu --skip-rate-limit
docker push <region>-docker.pkg.dev/spherex-blink/<repo>/blink-api:<tag>
gcloud run deploy blink-api --image=<image> --region=<region> --service-account=blink-api@spherex-blink.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars=BLINK_PROFILE=full,GCS_BUCKET=<bucket>,GCS_PREFIX=<prefix>,GOOGLE_CLOUD_PROJECT=spherex-blink,REAL_DATA_ENABLED=false,SERVE_PIXELS=false,CORS_ALLOW_ORIGINS=<site origin>,TRUST_FORWARDED_FOR=true,RATE_LIMIT_PER_MINUTE=60,MAX_CONCURRENT_REQUESTS=8
```

- `--allow-unauthenticated` makes the read-only API public; that is the point of it, and every route is limited on the server. Leave it out
  (and call it with an identity token) if the author wants it private. [unverified: flag behaviour]
- `TRUST_FORWARDED_FOR=true` only behind Cloud Run's front end, so the rate limit sees the client's address. [unverified: header behaviour]
- `ADMIN_TOKEN` (enables `POST /api/admin/reload`): set it as a secret at deploy time, typed by the author, never in the repository or this
  file. Empty = admin route disabled. [unverified: Secret Manager integration flags]
- The rate limit is in memory, per instance: with several instances the effective limit is multiplied. Cap the instances
  (`--max-instances`) if that matters. [unverified]

## 6. Health check and smoke test

```bash
curl -s https://<service-url>/api/health          # profile full, dataSource CLOUD, storeReachable true, problem null
node scripts/smoke_test_full.mjs https://<service-url> --sequence <approved id> --origin <site origin>
```

The smoke test checks: health, the list cap, the approved sequence served with numbers and provenance, **no pixel served by default**
(no pixel URL, the data route answers 403), 404 for unknown ids, CORS for the allowed origin only, and that the rate limit answers 429.
It was run by the agent only against a **local** `full` backend over a store built from synthetic test FITS (`docs/VALIDATION.md`); it has
never been run against a deployed service.

## 7. Point the site at it

`science.html?api=https://<service-url>`: the header badge shows `full · CLOUD · ok`, the data badge `REAL`, and "pixels not served".
If the service is down, the page shows the failure and loads nothing in its place.

## 8. Taking it down

`gcloud run services delete blink-api --region=<region>`; the bucket and its objects stay until the author deletes them.
