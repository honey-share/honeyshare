"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState(null);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    if (selectedFile.size > 50 * 1024 * 1024) {
      alert("File size must be 50 MB or less.");
      event.target.value = "";
      return;
    }

    setFile(selectedFile);
  };

  return (
    <main className="page">
      <div className="background-glow glow-one"></div>
      <div className="background-glow glow-two"></div>

      <section className="container">
        <header className="header">
          <div className="logo-mark">H</div>

          <div>
            <h1>HoneyShare</h1>
            <p>Fast. Simple. Temporary.</p>
          </div>
        </header>

        <div className="hero">
          <span className="badge">NO ACCOUNT REQUIRED</span>

          <h2>Share files in seconds.</h2>

          <p>
            Upload a file, get a short code, and let someone download it.
            Files disappear automatically after the transfer.
          </p>
        </div>

        <div className="transfer-grid">
          {/* SEND */}
          <div className="card send-card">
            <div className="card-top">
              <div>
                <span className="eyebrow">SEND</span>
                <h3>Upload a file</h3>
              </div>

              <div className="icon-circle upload-icon">↑</div>
            </div>

            <label className="drop-zone">
              <input
                type="file"
                onChange={handleFileChange}
                hidden
              />

              <div className="drop-icon">↑</div>

              {file ? (
                <>
                  <strong>{file.name}</strong>
                  <span>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </>
              ) : (
                <>
                  <strong>Choose a file</strong>
                  <span>Click here to browse your device</span>
                </>
              )}

              <small>Maximum file size: 50 MB</small>
            </label>

            <button className="primary-button" disabled={!file}>
              Upload File
              <span>→</span>
            </button>
          </div>

          {/* RECEIVE */}
          <div className="card receive-card">
            <div className="card-top">
              <div>
                <span className="eyebrow">RECEIVE</span>
                <h3>Download a file</h3>
              </div>

              <div className="icon-circle download-icon">↓</div>
            </div>

            <div className="code-area">
              <label htmlFor="code">Enter transfer code</label>

              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="00000"
              />

              <span className="code-hint">
                Enter the 5-digit code shared with you.
              </span>
            </div>

            <button className="secondary-button">
              Find File
              <span>→</span>
            </button>
          </div>
        </div>

        <div className="info-row">
          <div>
            <span className="info-icon">⚡</span>
            <span>Quick transfer</span>
          </div>

          <div>
            <span className="info-icon">🔒</span>
            <span>Private files</span>
          </div>

          <div>
            <span className="info-icon">⌛</span>
            <span>Auto deleted</span>
          </div>
        </div>

        <footer>
          <span>HoneyShare</span>
          <span>•</span>
          <span>Temporary file sharing</span>
        </footer>
      </section>
    </main>
  );
}
