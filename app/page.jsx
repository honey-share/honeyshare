"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const FUNCTION_URL =
  "https://fizsmmfgojsafjhlschq.supabase.co/functions/v1/transfer";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

export default function Home() {
  const [file, setFile] = useState(null);
  const [theme, setTheme] = useState("dark");

  const [uploading, setUploading] = useState(false);

  const [transferCode, setTransferCode] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);

  const [receiveCode, setReceiveCode] = useState("");
  const [downloading, setDownloading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  /* =========================
     THEME
  ========================= */

  useEffect(() => {
    const savedTheme =
      localStorage.getItem("honeyshare-theme");

    if (
      savedTheme === "light" ||
      savedTheme === "dark"
    ) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme =
      theme === "dark"
        ? "light"
        : "dark";

    setTheme(newTheme);

    localStorage.setItem(
      "honeyshare-theme",
      newTheme
    );
  };

  /* =========================
     FILE SIZE
  ========================= */

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  };

  /* =========================
     COUNTDOWN
  ========================= */

  const getRemainingTime = () => {
    if (!expiresAt) {
      return "";
    }

    const remaining = Math.max(
      0,
      new Date(expiresAt).getTime() -
        Date.now()
    );

    const totalSeconds =
      Math.floor(
        remaining / 1000
      );

    const minutes =
      Math.floor(
        totalSeconds / 60
      );

    const seconds =
      totalSeconds % 60;

    return `${String(
      minutes
    ).padStart(
      2,
      "0"
    )}:${String(
      seconds
    ).padStart(
      2,
      "0"
    )}`;
  };

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    const timer =
      setInterval(() => {
        if (
          Date.now() >=
          new Date(
            expiresAt
          ).getTime()
        ) {
          setExpiresAt(null);
          setTransferCode("");

          setMessage(
            "This transfer has expired."
          );
        }
      }, 1000);

    return () =>
      clearInterval(timer);
  }, [expiresAt]);

  /* =========================
     SELECT FILE
  ========================= */

  const chooseFile = (event) => {
    setError("");
    setMessage("");

    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (
      selectedFile.size >
      MAX_FILE_SIZE
    ) {
      setFile(null);

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }

      setError(
        "File size must be 50 MB or less."
      );

      return;
    }

    setFile(selectedFile);
  };

  /* =========================
     UPLOAD
  ========================= */

  const uploadFile = async () => {
    if (
      !file ||
      uploading
    ) {
      return;
    }

    setError("");
    setMessage("");
    setUploading(true);

    try {
      /*
        STEP 1
        Ask Supabase backend
        to create transfer
      */

      const initResponse =
        await fetch(
          FUNCTION_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              action:
                "init-upload",

              fileName:
                file.name,

              fileSize:
                file.size,

              mimeType:
                file.type ||
                "application/octet-stream",
            }),
          }
        );

      const initData =
        await initResponse.json();

      if (
        !initResponse.ok
      ) {
        throw new Error(
          initData.error ||
            "Unable to prepare upload."
        );
      }

      /*
        STEP 2
        Direct upload to
        Supabase Storage
      */

      const {
        error:
          uploadError,
      } =
        await supabase.storage
          .from(
            "temporary-files"
          )
          .uploadToSignedUrl(
            initData.path,
            initData.token,
            file
          );

      if (uploadError) {
        throw uploadError;
      }

      /*
        STEP 3
        Activate transfer
      */

      const activateResponse =
        await fetch(
          FUNCTION_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              action:
                "activate-upload",

              code:
                initData.code,
            }),
          }
        );

      const activateData =
        await activateResponse.json();

      if (
        !activateResponse.ok
      ) {
        throw new Error(
          activateData.error ||
            "Unable to finish upload."
        );
      }

      setTransferCode(
        initData.code
      );

      setExpiresAt(
        initData.expiresAt
      );

      setMessage(
        "File uploaded successfully."
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Upload failed. Please try again."
      );

      setTransferCode("");
      setExpiresAt(null);
    } finally {
      setUploading(false);
    }
  };

  /* =========================
     DOWNLOAD
  ========================= */

  const downloadFile = async () => {
    if (
      receiveCode.length !== 5 ||
      downloading
    ) {
      return;
    }

    setError("");
    setMessage("");
    setDownloading(true);

    try {
      /*
        STEP 1
        Verify code
      */

      const prepareResponse =
        await fetch(
          FUNCTION_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              action:
                "prepare-download",

              code:
                receiveCode,
            }),
          }
        );

      const prepareData =
        await prepareResponse.json();

      if (
        !prepareResponse.ok
      ) {
        throw new Error(
          prepareData.error ||
            "File not found."
        );
      }

      /*
        STEP 2
        Download from
        signed URL
      */

      const fileResponse =
        await fetch(
          prepareData.url
        );

      if (
        !fileResponse.ok
      ) {
        throw new Error(
          "Unable to download the file."
        );
      }

      const blob =
        await fileResponse.blob();

      /*
        STEP 3
        Trigger browser
        download
      */

      const blobUrl =
        URL.createObjectURL(
          blob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href =
        blobUrl;

      link.download =
        prepareData.fileName ||
        "download";

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      URL.revokeObjectURL(
        blobUrl
      );

      /*
        STEP 4
        Delete transfer
      */

      await fetch(
        FUNCTION_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            action:
              "complete-download",

            id:
              prepareData.id,
          }),
        }
      );

      setMessage(
        "Download complete. File deleted."
      );

      setReceiveCode("");
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Download failed. Please try again."
      );
    } finally {
      setDownloading(false);
    }
  };

  /* =========================
     RESET
  ========================= */

  const resetUpload = () => {
    setFile(null);
    setTransferCode("");
    setExpiresAt(null);
    setMessage("");
    setError("");

    if (
      fileInputRef.current
    ) {
      fileInputRef.current.value =
        "";
    }
  };

  /* =========================
     UI
  ========================= */

  return (
    <main
      className={`page ${theme}`}
    >
      <div className="background-glow glow-one"></div>

      <div className="background-glow glow-two"></div>

      <section className="container">

        {/* HEADER */}

        <header className="header">

          <div className="brand">

            <div className="logo-mark">
              H
            </div>

            <div>
              <h1>
                HoneyShare
              </h1>

              <p>
                Fast. Simple. Temporary.
              </p>
            </div>

          </div>

          <button
            className="theme-toggle"
            onClick={
              toggleTheme
            }
            aria-label="Toggle theme"
          >
            {theme ===
            "dark"
              ? "☀️"
              : "🌙"}
          </button>

        </header>

        {/* HERO */}

        <div className="hero">

          <span className="badge">
            NO ACCOUNT REQUIRED
          </span>

          <h2>
            Share files in seconds.
          </h2>

          <p>
            Upload a file, get a short
            code, and let someone download
            it. Files disappear automatically
            after the transfer.
          </p>

        </div>

        {/* TRANSFER */}

        <div className="transfer-grid">

          {/* SEND */}

          <div className="card send-card">

            <div className="card-top">

              <div>

                <span className="eyebrow">
                  SEND
                </span>

                <h3>
                  Upload a file
                </h3>

              </div>

              <div className="icon-circle upload-icon">
                ↑
              </div>

            </div>

            {!transferCode ? (

              <>

                <label className="drop-zone">

                  <input
                    ref={
                      fileInputRef
                    }
                    type="file"
                    onChange={
                      chooseFile
                    }
                    hidden
                  />

                  <div className="drop-icon">
                    ↑
                  </div>

                  {file ? (
                    <>
                      <strong
                        title={
                          file.name
                        }
                      >
                        {
                          file.name
                        }
                      </strong>

                      <span>
                        {formatFileSize(
                          file.size
                        )}
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>
                        Choose a file
                      </strong>

                      <span>
                        Click here to browse your device
                      </span>
                    </>
                  )}

                  <small>
                    Maximum file size: 50 MB
                  </small>

                </label>

                {uploading && (

                  <div className="uploading-state">

                    <span className="upload-spinner"></span>

                    <span>
                      Uploading file...
                    </span>

                  </div>

                )}

                <button
                  className="primary-button"
                  disabled={
                    !file ||
                    uploading
                  }
                  type="button"
                  onClick={
                    uploadFile
                  }
                >

                  {uploading
                    ? "Uploading..."
                    : "Upload File"}

                  {!uploading && (
                    <span>
                      →
                    </span>
                  )}

                </button>

              </>

            ) : (

              /* SUCCESS */

              <div className="success-area">

                <div className="uploaded-status">

                  <span className="uploaded-check">
                    ✓
                  </span>

                  <span>
                    Uploaded
                  </span>

                </div>

                <div className="file-info">

                  <span className="file-label">
                    FILE
                  </span>

                  <span
                    className="file-name"
                    title={
                      file?.name
                    }
                  >
                    {file?.name}
                  </span>

                </div>

                <span className="code-label">
                  YOUR TRANSFER CODE
                </span>

                <div className="transfer-code-box">

                  <span className="transfer-code">
                    {
                      transferCode
                    }
                  </span>

                </div>

                <div className="expiry">

                  Expires in{" "}

                  <strong>
                    {
                      getRemainingTime()
                    }
                  </strong>

                </div>

                <button
                  className="reset-button"
                  type="button"
                  onClick={
                    resetUpload
                  }
                >
                  Send another file
                </button>

              </div>

            )}

          </div>

          {/* RECEIVE */}

          <div className="card receive-card">

            <div className="card-top">

              <div>

                <span className="eyebrow">
                  RECEIVE
                </span>

                <h3>
                  Download a file
                </h3>

              </div>

              <div className="icon-circle download-icon">
                ↓
              </div>

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
                value={
                  receiveCode
                }
                onChange={(
                  event
                ) => {

                  setError("");
                  setMessage("");

                  setReceiveCode(
                    event.target.value
                      .replace(
                        /\D/g,
                        ""
                      )
                      .slice(
                        0,
                        5
                      )
                  );

                }}
              />

              <span className="code-hint">
                Enter the 5-digit code shared with you.
              </span>

            </div>

            <button
              className="secondary-button"
              type="button"
              disabled={
                receiveCode.length !==
                  5 ||
                downloading
              }
              onClick={
                downloadFile
              }
            >

              {downloading
                ? "Downloading..."
                : "Find File"}

              <span>
                →
              </span>

            </button>

          </div>

        </div>

        {/* STATUS */}

        {(message ||
          error) && (

          <div
            className={`status-message ${
              error
                ? "error"
                : "success"
            }`}
          >
            {
              error ||
              message
            }
          </div>

        )}

        {/* FEATURES */}

        <div className="info-row">

          <div>
            <span className="info-icon">
              ⚡
            </span>

            <span>
              Quick transfer
            </span>
          </div>

          <div>
            <span className="info-icon">
              🔒
            </span>

            <span>
              Private files
            </span>
          </div>

          <div>
            <span className="info-icon">
              ⌛
            </span>

            <span>
              Auto deleted
            </span>
          </div>

        </div>

        {/* FOOTER */}

        <footer>

          <span>
            HoneyShare
          </span>

          <span>
            •
          </span>

          <a
            href="https://github.com/honey-share"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>

          <span>
            •
          </span>

          <span>
            Temporary file sharing
          </span>

        </footer>

      </section>
    </main>
  );
}
