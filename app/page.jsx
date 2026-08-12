"use client";

import { useEffect, useState } from "react";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function Home() {
  const [file, setFile] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [code, setCode] = useState("");

  useEffect(() => {
    const savedTheme = localStorage.getItem("honeyshare-theme");

    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";

    setTheme(newTheme);
    localStorage.setItem("honeyshare-theme", newTheme);
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      alert("File size must be 50 MB or less.");
      event.target.value = "";
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleCodeChange = (event) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 5);
    setCode(value);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <main className={`page ${theme}`}>
      <div className="background-glow glow-one"></div>
      <div className="background-glow glow-two"></div>

      <section className="container">
        {/* HEADER */}
        <header className="header">
          <div className="brand">
            <div className="logo-mark">H</div>

            <div>
              <h1>HoneyShare</h1>
              <p>Fast. Simple. Temporary.</p>
            </div>
          </div>

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={
              theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </header>

        {/* HERO */}
        <div className="hero">
          <span className="badge">NO ACCOUNT REQUIRED</span>

          <h2>Share files in seconds.</h2>

          <p>
            Upload a file, get a short code, and let someone download it.
            Files disappear automatically after the transfer.
          </p>
        </div>

        {/* TRANSFER CARDS */}
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
                  <strong title={file.name}>{file.name}</strong>

                  <span>{formatFileSize(file.size)}</span>
                </>
              ) : (
                <>
                  <strong>Choose a file</strong>

                  <span>
                    Click here to browse your device
                  </span>
                </>
              )}

              <small>Maximum file size: 50 MB</small>
            </label>

            <button
              className="primary-button"
              disabled={!file}
              type="button"
            >
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
              <label htmlFor="code">
                Enter transfer code
              </label>

              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={5}
                placeholder="00000"
                value={code}
                onChange={handleCodeChange}
                aria-label="5 digit transfer code"
              />

              <span className="code-hint">
                Enter the 5-digit code shared with you.
              </span>
            </div>

            <button
              className="secondary-button"
              type="button"
              disabled={code.length !== 5}
            >
              Find File
              <span>→</span>
            </button>
          </div>
        </div>

        {/* FEATURES */}
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

        {/* FOOTER */}
        <footer>
          <span>HoneyShare</span>

          <span>•</span>

          <a
            href="https://github.com/honey-share"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>

          <span>•</span>

          <span>Temporary file sharing</span>
        </footer>
      </section>
    </main>
  );
}
