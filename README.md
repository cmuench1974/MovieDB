# MovieDB

Personal movie catalog: scan a folder of video files, look them up on [TMDB](https://www.themoviedb.org/), and browse the result in the browser. Viewing is public. Changing the library requires an admin login.

## What you need

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- A free [TMDB API key](https://www.themoviedb.org/settings/api)
- A folder of movies: a local/NFS path mounted into the container, and/or SMB shares added in the admin UI

Local and NFS folders must be **mounted into the container** (Docker bind-mount). SMB shares are opened by the app over the network, so they do not need a volume.

## Quick start

1. Copy the environment file and fill it in:

```bash
cp .env.example .env
```

Set at least:

- `AUTH_SECRET` (long random string)
- `ADMIN_PASSWORD` (at least 8 characters; change the default)
- `MEDIA_PATH` (optional host path bind-mounted at `/media` for local/NFS folders)

`TMDB_API_KEY` is optional in `.env`. You can paste the key later in **Admin → TMDB API key**.

2. Start the stack:

```bash
docker compose up --build
```

3. Open [http://localhost:3000](http://localhost:3000) for the catalog.
4. Sign in at [http://localhost:3000/login](http://localhost:3000/login).
5. Under **Admin** paste your [TMDB API key](https://www.themoviedb.org/settings/api), add folders, run a scan, then review unmatched titles.
6. Use **Library** to hide, edit, or remove individual movies. Hidden titles stay in the database but disappear from the public catalog. Removing a movie does not delete files on disk.

### SMB shares

On Docker Desktop for Windows the app lists shares through a small **host bridge** (`scripts/ensure-smb-bridge.ps1`). That uses the SMB session Windows already has (mapped drives such as `Y:` → `\\JUPITER\media`), so you can add the NAS by name without a password.

Start the bridge, then the stack:

```powershell
powershell -File .\scripts\ensure-smb-bridge.ps1
docker compose up --build
```

In Admin → Folders:

- **Host:** `JUPITER` or the LAN IP
- **Share:** `media` (share name only)
- **Subfolder:** e.g. `movies` (optional)
- Username/password: leave empty if the share is already mapped on this PC

If the bridge is not running, the container falls back to Samba `smbclient` and then needs credentials plus a resolvable IP.

On first start the admin user is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Later changes to `ADMIN_PASSWORD` in `.env` do **not** update an existing user (this avoids silently resetting your password on every restart).

## How matching works

1. Filenames such as `The Matrix (1999).mkv` or `the.matrix.1999.1080p.mkv` are parsed into a title and year.
2. TMDB search runs with that title.
3. A clear title+year match is stored automatically.
4. Ambiguous results go to **Admin → Review matches**. Pick a poster, or paste a TMDB URL like `https://www.themoviedb.org/movie/603-the-matrix`.

## Security notes

- Do not expose the admin port to the internet without HTTPS and a strong password.
- Local media mounts should stay **read-only**.
- SMB passwords are encrypted with `AUTH_SECRET` before they are stored. Changing `AUTH_SECRET` later makes stored SMB passwords unreadable — re-add those shares.
- Full disk paths are not shown on public movie pages — only filenames.
- Keep `.env` private (`AUTH_SECRET`, `ADMIN_PASSWORD`, `TMDB_API_KEY`, database password, share credentials).

## Development (optional)

If you have Node.js 22 locally:

```bash
docker compose up db -d
npx prisma migrate deploy
npx prisma generate
node prisma/seed.js
npm run dev
```

Point `DATABASE_URL` at `postgresql://moviedb:moviedb@localhost:5432/moviedb` and `SCAN_PATHS` at a local movies folder.
