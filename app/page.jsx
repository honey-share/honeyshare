"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { QRCodeCanvas } from "qrcode.react";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const FUNCTION_URL =
  `${SUPABASE_URL}/functions/v1/transfer-v2`;

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const TRANSFER_SECONDS = 5 * 60;

const VISITOR_STORAGE_KEY =
  "honeyshare-visitor-id";

const PRESENCE_CHANNEL =
  "honeyshare-live-users";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* =====================================================
   VISITOR ID
===================================================== */

function getVisitorId() {
  try {
    let visitorId =
      localStorage.getItem(
        VISITOR_STORAGE_KEY
      );

    if (!visitorId) {
      visitorId =
        typeof crypto !== "undefined" &&
        crypto.randomUUID
          ? crypto.randomUUID()
          : `visitor-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 10)}`;

      localStorage.setItem(
        VISITOR_STORAGE_KEY,
        visitorId
      );
    }

    return visitorId;
  } catch {
    return `visitor-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

/* =====================================================
   HOME
===================================================== */

export default function Home() {
  const [theme, setTheme] =
    useState("dark");

  const [file, setFile] =
    useState(null);

  const [uploading, setUploading] =
    useState(false);

  const [transferCode, setTransferCode] =
    useState("");

  const [expiresAt, setExpiresAt] =
    useState(null);

  const [remainingSeconds, setRemainingSeconds] =
    useState(0);

  const [receiveCode, setReceiveCode] =
    useState("");

  const [downloading, setDownloading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [origin, setOrigin] =
    useState("");

  /* LIVE USERS */

  const [liveUsers, setLiveUsers] =
    useState(0);

  const fileInputRef =
    useRef(null);

  const qrAttempted =
    useRef(false);

  const presenceChannelRef =
    useRef(null);

  /* =====================================================
     INITIAL + ANALYTICS + LIVE USERS
  ===================================================== */

  useEffect(() => {
    setOrigin(
      window.location.origin
    );

    /* Theme */

    const savedTheme =
      localStorage.getItem(
        "honeyshare-theme"
      );

    if (
      savedTheme === "dark" ||
      savedTheme === "light"
    ) {
      setTheme(savedTheme);
    }

    /* Anonymous visitor */

    const visitorId =
      getVisitorId();

    /*
      Record visitor in database.

      This updates:
      - total visitor
      - today's visitor
      - monthly visitor
    */

    const recordVisitor =
      async () => {
        try {
          const {
            error: visitorError,
          } =
            await supabase.rpc(
              "record_visitor",
              {
                p_visitor_id:
                  visitorId,
              }
            );

          if (visitorError) {
            console.error(
              "Visitor analytics error:",
              visitorError
            );
          }
        } catch (err) {
          console.error(
            "Visitor tracking error:",
            err
          );
        }
      };

    recordVisitor();

    /* =================================================
       SUPABASE REALTIME PRESENCE
    ================================================= */

    const channel =
      supabase.channel(
        PRESENCE_CHANNEL,
        {
          config: {
            presence: {
              key: visitorId,
            },
          },
        }
      );

    presenceChannelRef.current =
      channel;

    const updateLiveUsers =
      () => {
        const state =
          channel.presenceState();

        /*
          Presence keys are unique visitor IDs.

          Same visitor opening multiple tabs
          will still count as one visitor.
        */

        const count =
          Object.keys(
            state || {}
          ).length;

        setLiveUsers(count);
      };

    channel.on(
      "presence",
      {
        event: "sync",
      },
      updateLiveUsers
    );

    channel.on(
      "presence",
      {
        event: "join",
      },
      updateLiveUsers
    );

    channel.on(
      "presence",
      {
        event: "leave",
      },
      updateLiveUsers
    );

    channel.subscribe(
      async (status) => {
        if (
          status ===
          "SUBSCRIBED"
        ) {
          try {
            await channel.track({
              visitor_id:
                visitorId,

              online_at:
                new Date().toISOString(),
            });

            updateLiveUsers();
          } catch (err) {
            console.error(
              "Presence tracking error:",
              err
            );
          }
        }
      }
    );

    return () => {
      if (
        presenceChannelRef.current
      ) {
        supabase.removeChannel(
          presenceChannelRef.current
        );

        presenceChannelRef.current =
          null;
      }
    };
  }, []);

  /* =====================================================
     THEME
  ===================================================== */

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

  /* =====================================================
     FILE SIZE
  ===================================================== */

  const formatFileSize =
    (bytes) => {
      if (
        bytes <
        1024 * 1024
      ) {
        return `${(
          bytes / 1024
        ).toFixed(1)} KB`;
      }

      return `${(
        bytes /
        (1024 * 1024)
      ).toFixed(2)} MB`;
    };

  /* =====================================================
     TIMER
  ===================================================== */

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer =
      () => {
        const remaining =
          Math.max(
            0,
            new Date(
              expiresAt
            ).getTime() -
              Date.now()
          );

        const seconds =
          Math.ceil(
            remaining / 1000
          );

        setRemainingSeconds(
          seconds
        );

        if (
          seconds <= 0
        ) {
          setTransferCode("");
          setExpiresAt(null);

          setMessage(
            "Transfer expired. The file will be removed automatically."
          );
        }
      };

    updateTimer();

    const interval =
      setInterval(
        updateTimer,
        1000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [expiresAt]);

  const formatTime =
    () => {
      const minutes =
        Math.floor(
          remainingSeconds /
            60
        );

      const seconds =
        remainingSeconds %
        60;

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

  /* =====================================================
     SELECT FILE
  ===================================================== */

  const handleFileSelect =
    (event) => {
      setError("");
      setMessage("");

      const selected =
        event.target.files?.[0];

      if (!selected)
        return;

      if (
        selected.size >
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
          "Maximum file size is 50 MB."
        );

        return;
      }

      setFile(selected);
    };

  /* =====================================================
     UPLOAD
  ===================================================== */

  const uploadFile =
    async () => {
      if (
        !file ||
        uploading
      )
        return;

      setUploading(true);
      setError("");
      setMessage("");

      try {
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
              "Unable to create transfer."
          );
        }

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
              "Unable to activate transfer."
          );
        }

        setTransferCode(
          initData.code
        );

        setExpiresAt(
          initData.expiresAt
        );

        setRemainingSeconds(
          TRANSFER_SECONDS
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
        setRemainingSeconds(0);
      } finally {
        setUploading(false);
      }
    };

  /* =====================================================
     DOWNLOAD
  ===================================================== */

  const downloadFile =
    async (
      suppliedCode = ""
    ) => {
      const code =
        suppliedCode ||
        receiveCode;

      if (
        !/^\d{5}$/.test(
          code
        ) ||
        downloading
      ) {
        return;
      }

      setDownloading(true);
      setError("");
      setMessage("");

      try {
        const response =
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

                code,
              }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.error ||
              "File not found."
          );
        }

        const fileResponse =
          await fetch(
            data.url
          );

        if (
          !fileResponse.ok
        ) {
          throw new Error(
            "Unable to download file."
          );
        }

        const blob =
          await fileResponse.blob();

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
          data.fileName ||
          "HoneyShare-file";

        document.body.appendChild(
          link
        );

        link.click();

        link.remove();

        setTimeout(
          () => {
            URL.revokeObjectURL(
              blobUrl
            );
          },
          1000
        );

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

              id: data.id,
            }),
          }
        );

        setReceiveCode("");

        setMessage(
          "Download complete. File deleted automatically."
        );
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "Download failed."
        );
      } finally {
        setDownloading(false);
      }
    };

  /* =====================================================
     QR
  ===================================================== */

  const qrValue =
    origin &&
    transferCode
      ? `${origin}/?code=${transferCode}`
      : "";

  /* =====================================================
     QR AUTO DOWNLOAD
  ===================================================== */

  useEffect(() => {
    if (
      qrAttempted.current
    ) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const code =
      params.get("code");

    if (
      code &&
      /^\d{5}$/.test(
        code
      )
    ) {
      qrAttempted.current =
        true;

      setReceiveCode(
        code
      );

      setMessage(
        "Transfer found. Starting download..."
      );

      const timer =
        setTimeout(
          () => {
            downloadFile(
              code
            );
          },
          700
        );

      return () =>
        clearTimeout(
          timer
        );
    }
  }, []);

  /* =====================================================
     RESET
  ===================================================== */

  const resetUpload =
    () => {
      setFile(null);

      setTransferCode("");

      setExpiresAt(null);

      setRemainingSeconds(
        0
      );

      setMessage("");

      setError("");

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    };

  /* =====================================================
     UI
  ===================================================== */

  return (
    <main
      className={`page ${theme}`}
    >
      <div className="background-glow glow-one" />

      <div className="background-glow glow-two" />

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

          <div className="header-actions">

            {/* LIVE USERS */}

            <div
              className="live-users-badge"
              title="Currently active visitors"
            >

              <span className="live-users-dot" />

              <strong>
                {liveUsers}
              </strong>

              <span>
                Live
              </span>

            </div>

            {/* THEME */}

            <button
              type="button"
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

          </div>

        </header>

        {/* HERO */}

        <section className="hero">

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

        </section>

        {/* TRANSFER GRID */}

        <div className="transfer-grid">

          {/* SEND */}

          <section className="card send-card">

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
                    hidden
                    onChange={
                      handleFileSelect
                    }
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
                        {file.name}
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

                    <span className="upload-spinner" />

                    <span>
                      Uploading file...
                    </span>

                  </div>

                )}

                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    !file ||
                    uploading
                  }
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

              <div className="success-area">

                <div className="uploaded-status">

                  <span className="uploaded-check">
                    ✓
                  </span>

                  Uploaded

                </div>

                <div className="success-content">

                  <div className="code-success">

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
                        {transferCode}
                      </span>

                    </div>

                    <div className="expiry">

                      Expires in{" "}

                      <strong>
                        {formatTime()}
                      </strong>

                    </div>

                    <button
                      type="button"
                      className="reset-button"
                      onClick={
                        resetUpload
                      }
                    >
                      Send another file
                    </button>

                  </div>

                  <div className="qr-section">

                    <span className="qr-label">
                      SCAN TO DOWNLOAD
                    </span>

                    <div className="qr-box">

                      {qrValue && (

                        <QRCodeCanvas
                          value={
                            qrValue
                          }
                          size={180}
                          bgColor="#ffffff"
                          fgColor="#111827"
                          level="M"
                          includeMargin={
                            true
                          }
                        />

                      )}

                    </div>

                    <span className="qr-hint">
                      Scan with your phone camera
                    </span>

                  </div>

                </div>

              </div>

            )}

          </section>

          {/* RECEIVE */}

          <section className="card receive-card">

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
              type="button"
              className="secondary-button"
              disabled={
                receiveCode.length !==
                  5 ||
                downloading
              }
              onClick={() =>
                downloadFile()
              }
            >

              {downloading
                ? "Downloading..."
                : "Find File"}

              <span>
                →
              </span>

            </button>

          </section>

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

            Quick transfer

          </div>

          <div>

            <span className="info-icon">
              🔒
            </span>

            Private files

          </div>

          <div>

            <span className="info-icon">
              ⌛
            </span>

            Auto deleted

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
