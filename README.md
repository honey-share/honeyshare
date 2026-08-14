# 🍯 HoneyShare

**Fast. Simple. Temporary.**

HoneyShare is a lightweight temporary file-sharing web application that allows users to upload files, generate a short 5-digit transfer code, and share files with another person without requiring an account.

The application is designed for quick, temporary transfers with automatic expiration, QR sharing, upload/download progress, multiple-file support, and a modern responsive interface.

---

## ✨ Features

- 📤 Upload files without creating an account
- 🔢 Generate a unique 5-digit numerical transfer code
- 📥 Download files using the transfer code
- 📱 QR code sharing
- 🔗 Smart share/download page
- 🖱️ Drag & drop file selection
- 📚 Multiple file selection
- ❌ Remove individual files before upload
- 🗜️ Multiple files are automatically packaged into a ZIP archive
- 📊 Upload progress
- 📊 Download progress
- ⏱️ Temporary transfer expiration
- 🧹 Automatic file deletion after transfer
- 🌙 Dark mode
- ☀️ Light mode
- 🟢 Live users indicator
- 📈 Visitor analytics
- 📱 Responsive design
- 🔒 Temporary/private file-sharing workflow
- 🚫 No account required for the main sharing experience

---

## 🛠️ Tech Stack

### Frontend

- Next.js
- React
- JavaScript
- CSS
- `next/font`
- `qrcode.react`

### File Handling

- `JSZip`
- `tus-js-client`

### Backend

- Supabase
- Supabase Edge Functions
- Supabase Storage
- Supabase Realtime
- PostgreSQL

### Deployment

- GitHub
- Vercel

---

## 📁 Project Structure

```text
honeyshare/
│
├── app/
│   ├── page.jsx
│   ├── layout.jsx
│   ├── globals.css
│   │
│   ├── analytics/
│   │   └── page.jsx
│   │
│   └── share/
│       └── page.jsx
│
├── public/
│   └── honeyshare.svg
│
├── package.json
├── README.md
└── ...
```

---

## 🔄 How HoneyShare Works

### Sender

```text
Select file(s)
      ↓
Validate files
      ↓
Create temporary transfer
      ↓
Upload file / ZIP
      ↓
Generate 5-digit code
      ↓
Generate QR code
      ↓
Share code or QR
```

### Receiver

```text
Open HoneyShare
      ↓
Enter 5-digit code
      ↓
Find file
      ↓
Download with progress
      ↓
Download completed
      ↓
File deleted automatically
```

---

## 📦 File Limits

Current application settings:

```text
Maximum files per transfer : 10
Maximum total size         : 50 MB
Maximum individual size    : 50 MB
Transfer expiry            : 5 minutes
Transfer code              : 5-digit numeric
```

When multiple files are selected, HoneyShare creates a ZIP archive and transfers the archive using one transfer code.

---

## ❌ Remove Selected Files

Before uploading, users can remove any individual selected file.

Example:

```text
✓ document.pdf                     1.2 MB   ×
✓ photo.jpg                        2.4 MB   ×
✓ report.pdf                       800 KB   ×
```

Removing a file automatically updates the selected-file count and total size.

---

## 📱 QR Code Sharing

After a successful upload, HoneyShare generates a QR code.

The QR code opens a temporary share page:

```text
/share?code=12345
```

The receiver can scan the QR code from a phone and open the secure download page directly.

---

## 📊 Upload & Download Progress

HoneyShare provides progress indicators during file transfers.

### Upload

```text
Uploading 68%

████████████████░░░░░░

17 MB / 25 MB
```

### Download

```text
Downloading 72%

██████████████████░░░░

18 MB / 25 MB
```

---

## ⏱️ Temporary Transfers

Transfers are temporary by design.

A transfer:

1. is created,
2. receives a 5-digit code,
3. remains available for the configured expiry period,
4. can be downloaded,
5. is marked as completed,
6. and is removed according to the cleanup flow.

HoneyShare is intended for temporary sharing rather than permanent cloud storage.

---

## 📊 Analytics

The project includes:

- live users on the home page
- visitor tracking
- analytics dashboard
- visitor statistics
- realtime presence

Supabase is used for database storage and realtime presence tracking.

---

## 🎨 Design

HoneyShare uses a modern SaaS-inspired UI with:

- premium typography
- rounded cards
- dark/light themes
- soft gradient backgrounds
- animated live-user indicator
- upload/download progress indicators
- responsive layouts
- QR sharing
- HoneyShare branding

The current branding uses the **HoneyShare Logo #2** concept with a golden honey badge and black `H`.

---

## 🍯 Branding

Current logo:

```text
Golden honey badge
       +
Black H
       +
Honey drip effect
```

The SVG logo is stored at:

```text
public/honeyshare.svg
```

It is used for the HoneyShare branding and browser icon.

---

## ⚙️ Environment Variables

Create a `.env.local` file for local development.

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

The application can also support the legacy Supabase variable:

```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

### Important

Do not commit private secrets or service-role keys to GitHub.

---

## 🚀 Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

---

## 🏗️ Production Build

Build the application:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

---

## ☁️ Vercel Deployment

HoneyShare is designed to be deployed on Vercel using GitHub.

### Steps

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Add the required environment variables.
4. Deploy the project.
5. Every new commit to the configured branch can trigger a new deployment.

### Build Command

```text
npm run build
```

### Install Command

```text
npm install
```

### Framework

```text
Next.js
```

---

## 🗄️ Supabase

HoneyShare uses Supabase for:

- transfer metadata
- temporary file storage
- Edge Functions
- visitor analytics
- realtime presence
- PostgreSQL database

The main temporary storage bucket is:

```text
temporary-files
```

The backend transfer function handles:

```text
init-upload
activate-upload
prepare-download
complete-download
cleanup
```

and the temporary transfer lifecycle.

---

## 🔐 Security

HoneyShare is designed for temporary file sharing.

Recommended production practices:

- Never expose service-role keys in browser code.
- Store secrets in Vercel environment variables.
- Validate file sizes on both frontend and backend.
- Keep transfer codes short-lived.
- Automatically clean expired transfers.
- Restrict storage policies appropriately.
- Do not use the service as permanent file storage.

---

## 🧪 Testing Checklist

### Upload

- [ ] Single file upload
- [ ] Multiple files upload
- [ ] ZIP generation
- [ ] Drag & drop
- [ ] Remove selected file
- [ ] 50 MB validation
- [ ] Maximum 10 files
- [ ] Upload progress
- [ ] Transfer code generation

### Download

- [ ] Valid 5-digit code
- [ ] Invalid code handling
- [ ] Expired code handling
- [ ] Download progress
- [ ] Correct filename
- [ ] Automatic deletion

### QR

- [ ] QR generated after upload
- [ ] QR scans successfully
- [ ] QR opens `/share?code=...`
- [ ] Smart download page works

### UI

- [ ] Dark mode
- [ ] Light mode
- [ ] Responsive layout
- [ ] Live users count
- [ ] Analytics dashboard
- [ ] Browser favicon
- [ ] HoneyShare logo

---

## 🌐 Live Website

**Website:**

https://honeyshare.vercel.app

**GitHub:**

https://github.com/honey-share

---

## 📄 License

This project can be released under the license of your choice.

For example:

```text
MIT License
```

---

## 👤 Project

**HoneyShare**

> Fast. Simple. Temporary.

Built for quick and temporary file sharing with a simple user experience.
