# Facial Biometric Attendance Backend (mock)

Simple Node.js + Express mock backend for a facial-biometric attendance demo.

Prerequisites
- Node.js (v16+ recommended)

Quick start

1. Install dependencies

```powershell
npm install
```

2. (Optional) Provide a persistent API key via environment variable. If you do not set this, the server will generate a temporary API key at startup and print it to the console.

PowerShell example (temporary for the session):

```powershell
$env:ATTENDANCE_API_KEY = "your_api_key_here"
npm start
```

3. Run the server

```powershell
npm start
```

Health check (no API key needed):

```powershell
curl http://localhost:3000/health
```

API notes
- All protected endpoints are under `/api/v1/*` and require an `X-API-Key` header with the configured key.
- Example header: `X-API-Key: <key>`

Security note
- Prefer setting `ATTENDANCE_API_KEY` in your environment or a secure secrets store for production. The server will not print your env-provided key to the logs.

Files of interest
- `server.js` - main application
- `package.json` - project metadata & scripts

License
- (none specified)
