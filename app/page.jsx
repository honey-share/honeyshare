"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { QRCodeCanvas } from "qrcode.react";
import JSZip from "jszip";
import * as tus from "tus-js-client";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const FUNCTION_URL =
  `${SUPABASE_URL}/functions/v1/transfer-v2`;

const MAX_FILE_SIZE =
  50 * 1024 * 1024;

const MAX_FILES = 10;

const TRANSFER_SECONDS =
  5 * 60;

const VISITOR_STORAGE_KEY =
  "honeyshare-visitor-id";

const PRESENCE_CHANNEL =
  "honeyshare-live-users";

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

/* =====================================================
   HELPERS
===================================================== */

function getVisitorId() {
  try {
    let id =
      localStorage.getItem(
        VISITOR_STORAGE_KEY
      );

    if (!id) {
      id =
        typeof crypto !==
          "undefined" &&
        crypto.randomUUID
          ? crypto.randomUUID()
          : `visitor-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 10)}`;

      localStorage.setItem(
        VISITOR_STORAGE_KEY,
        id
      );
    }

    return id;
  } catch {
    return `visitor-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

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
}

function formatTime(seconds) {
  const minutes =
    Math.floor(
      seconds / 60
    );

  const remaining =
    seconds % 60;

  return `${String(
    minutes
  ).padStart(2, "0")}:${String(
    remaining
  ).padStart(2, "0")}`;
}

export default function Home() {
  /* =====================================================
     THEME
  ===================================================== */

  const [theme, setTheme] =
    useState("dark");

  /* =====================================================
     FILES
  ===================================================== */

  const [files, setFiles] =
    useState([]);

  const [dragActive, setDragActive] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [uploadProgress, setUploadProgress] =
    useState(0);

  const [uploadStage, setUploadStage] =
    useState("");

  /* =====================================================
     TRANSFER
  ===================================================== */

  const [transferCode, setTransferCode] =
    useState("");

  const [expiresAt, setExpiresAt] =
    useState(null);

  const [remainingSeconds, setRemainingSeconds] =
    useState(0);

  /* =====================================================
     RECEIVE
  ===================================================== */

  const [receiveCode, setReceiveCode] =
    useState("");

  const [downloading, setDownloading] =
    useState(false);

  const [downloadProgress, setDownloadProgress] =
    useState(0);

  const [downloadedBytes, setDownloadedBytes] =
    useState(0);

  const [downloadTotal, setDownloadTotal] =
    useState(0);

  /* =====================================================
     UI
  ===================================================== */

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [origin, setOrigin] =
    useState("");

  const [liveUsers, setLiveUsers] =
    useState(0);

  const fileInputRef =
    useRef(null);

  const presenceChannelRef =
    useRef(null);

  /* =====================================================
     INITIAL
  ===================================================== */

  useEffect(() => {
    setOrigin(
      window.location.origin
    );

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

    const visitorId =
      getVisitorId();

    /* ANALYTICS */

    const recordVisitor =
      async () => {
        try {
          await supabase.rpc(
            "record_visitor",
            {
              p_visitor_id:
                visitorId,
            }
          );
        } catch (err) {
          console.error(
            "Visitor tracking:",
            err
          );
        }
      };

    recordVisitor();

    /* LIVE USERS */

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

        setLiveUsers(
          Object.keys(
            state || {}
          ).length
        );
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
          await channel.track({
            visitor_id:
              visitorId,

            online_at:
              new Date().toISOString(),
          });

          updateLiveUsers();
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

  const toggleTheme =
    () => {
      const next =
        theme === "dark"
          ? "light"
          : "dark";

      setTheme(next);

      localStorage.setItem(
        "honeyshare-theme",
        next
      );
    };

  /* =====================================================
     TIMER
  ===================================================== */

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(
        0
      );

      return;
    }

    const update =
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

    update();

    const interval =
      setInterval(
        update,
        1000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [expiresAt]);

  /* =====================================================
     VALIDATE FILES
  ===================================================== */

  const validateFiles =
    (incoming) => {
      const selected =
        Array.from(
          incoming
        );

      if (!selected.length) {
        return;
      }

      setError("");
      setMessage("");

      if (
        selected.length >
        MAX_FILES
      ) {
        setError(
          `Maximum ${MAX_FILES} files can be selected.`
        );

        return;
      }

      const totalSize =
        selected.reduce(
          (sum, item) =>
            sum + item.size,
          0
        );

      if (
        selected.some(
          (item) =>
            item.size >
            MAX_FILE_SIZE
        )
      ) {
        setError(
          "One of the selected files is larger than 50 MB."
        );

        return;
      }

      if (
        totalSize >
        MAX_FILE_SIZE
      ) {
        setError(
          "Total selected file size cannot exceed 50 MB."
        );

        return;
      }

      setFiles(
        selected
      );
    };

  /* =====================================================
     FILE INPUT
  ===================================================== */

  const handleFileSelect =
    (event) => {
      validateFiles(
        event.target.files
      );
    };

  /* =====================================================
     DRAG DROP
  ===================================================== */

  const handleDragOver =
    (event) => {
      event.preventDefault();

      setDragActive(
        true
      );
    };

  const handleDragLeave =
    (event) => {
      event.preventDefault();

      setDragActive(
        false
      );
    };

  const handleDrop =
    (event) => {
      event.preventDefault();

      setDragActive(
        false
      );

      validateFiles(
        event.dataTransfer
          .files
      );
    };

  /* =====================================================
     PREPARE UPLOAD
  ===================================================== */

  const prepareUploadFile =
    async () => {
      if (
        files.length === 1
      ) {
        return files[0];
      }

      setUploadStage(
        "Preparing ZIP..."
      );

      setUploadProgress(0);

      const zip =
        new JSZip();

      files.forEach(
        (item) => {
          zip.file(
            item.name,
            item
          );
        }
      );

      const blob =
        await zip.generateAsync(
          {
            type: "blob",

            compression:
              "STORE",

            streamFiles:
              true,
          },

          (metadata) => {
            setUploadProgress(
              Math.round(
                metadata.percent
              )
            );
          }
        );

      if (
        blob.size >
        MAX_FILE_SIZE
      ) {
        throw new Error(
          "The generated ZIP is larger than the 50 MB limit."
        );
      }

      return new File(
        [blob],
        `HoneyShare-${Date.now()}.zip`,
        {
          type:
            "application/zip",
        }
      );
    };

  /* =====================================================
     TUS UPLOAD
  ===================================================== */

  const uploadWithProgress =
    (
      uploadFile,
      path,
      token
    ) => {
      return new Promise(
        (
          resolve,
          reject
        ) => {
          const projectRef =
            new URL(
              SUPABASE_URL
            ).hostname.split(
              "."
            )[0];

          const endpoint =
            `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;

          const upload =
            new tus.Upload(
              uploadFile,
              {
                endpoint,

                headers: {
                  "x-signature":
                    token,
                },

                metadata: {
                  bucketName:
                    "temporary-files",

                  objectName:
                    path,

                  contentType:
                    uploadFile.type ||
                    "application/octet-stream",

                  cacheControl:
                    "3600",
                },

                chunkSize:
                  6 *
                  1024 *
                  1024,

                retryDelays: [
                  0,
                  3000,
                  5000,
                  10000,
                  20000,
                ],

                uploadDataDuringCreation:
                  true,

                removeFingerprintOnSuccess:
                  true,

                onError:
                  (uploadError) => {
                    reject(
                      uploadError
                    );
                  },

                onProgress:
                  (
                    bytesUploaded,
                    bytesTotal
                  ) => {
                    const percent =
                      Math.round(
                        (bytesUploaded /
                          bytesTotal) *
                          100
                      );

                    setUploadProgress(
                      percent
                    );

                    setUploadStage(
                      `Uploading ${percent}%`
                    );
                  },

                onSuccess:
                  () => {
                    resolve();
                  },
              }
            );

          upload.start();
        }
      );
    };

  /* =====================================================
     UPLOAD
  ===================================================== */

  const uploadFiles =
    async () => {
      if (
        !files.length ||
        uploading
      ) {
        return;
      }

      setUploading(
        true
      );

      setUploadProgress(
        0
      );

      setError("");
      setMessage("");

      try {
        const uploadFile =
          await prepareUploadFile();

        setUploadStage(
          "Starting upload..."
        );

        setUploadProgress(
          0
        );

        const initResponse =
          await fetch(
            FUNCTION_URL,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                action:
                  "init-upload",

                fileName:
                  uploadFile.name,

                fileSize:
                  uploadFile.size,

                mimeType:
                  uploadFile.type ||
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

        await uploadWithProgress(
          uploadFile,
          initData.path,
          initData.token
        );

        setUploadStage(
          "Finalizing..."
        );

        const activateResponse =
          await fetch(
            FUNCTION_URL,
            {
              method:
                "POST",

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

        setUploadProgress(
          100
        );

        setUploadStage(
          "Uploaded"
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
        setUploading(
          false
        );
      }
    };

  /* =====================================================
     DOWNLOAD WITH PROGRESS
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

      setDownloading(
        true
      );

      setDownloadProgress(
        0
      );

      setDownloadedBytes(
        0
      );

      setDownloadTotal(
        0
      );

      setError("");
      setMessage("");

      try {
        const prepareResponse =
          await fetch(
            FUNCTION_URL,
            {
              method:
                "POST",

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
          await prepareResponse.json();

        if (
          !prepareResponse.ok
        ) {
          throw new Error(
            data.error ||
              "File not found."
          );
        }

        const response =
          await fetch(
            data.url
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "Unable to download file."
          );
        }

        const total =
          Number(
            response.headers.get(
              "content-length"
            )
          ) ||
          Number(
            data.fileSize
          ) ||
          0;

        setDownloadTotal(
          total
        );

        const chunks =
          [];

        let received = 0;

        if (
          response.body
        ) {
          const reader =
            response.body.getReader();

          while (true) {
            const {
              done,
              value,
            } =
              await reader.read();

            if (done) break;

            chunks.push(
              value
            );

            received +=
              value.byteLength;

            setDownloadedBytes(
              received
            );

            if (total > 0) {
              setDownloadProgress(
                Math.min(
                  100,
                  Math.round(
                    (received /
                      total) *
                      100
                  )
                )
              );
            }
          }
        } else {
          const blob =
            await response.blob();

          chunks.push(
            blob
          );

          received =
            blob.size;

          setDownloadedBytes(
            received
          );

          setDownloadProgress(
            100
          );
        }

        const blob =
          new Blob(
            chunks,
            {
              type:
                data.mimeType ||
                "application/octet-stream",
            }
          );

        setDownloadProgress(
          100
        );

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
          2000
        );

        /*
          Delete only AFTER the complete
          file has been downloaded.
        */

        await fetch(
          FUNCTION_URL,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              action:
                "complete-download",

              id:
                data.id,
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
        setDownloading(
          false
        );
      }
    };

  /* =====================================================
     QR LINK
  ===================================================== */

  const qrValue =
    origin &&
    transferCode
      ? `${origin}/share?code=${transferCode}`
      : "";

  /* =====================================================
     RESET
  ===================================================== */

  const resetUpload =
    () => {
      setFiles([]);

      setTransferCode("");

      setExpiresAt(null);

      setRemainingSeconds(
        0
      );

      setUploadProgress(
        0
      );

      setUploadStage("");

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
     SELECTED FILE TOTAL
  ===================================================== */

  const totalSelectedSize =
    files.reduce(
      (sum, item) =>
        sum + item.size,
      0
    );

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

            <button
              type="button"
              className="theme-toggle"
              onClick={
                toggleTheme
              }
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

        {/* TRANSFER */}

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

                <label
                  className={`drop-zone ${
                    dragActive
                      ? "drag-active"
                      : ""
                  }`}
                  onDragOver={
                    handleDragOver
                  }
                  onDragLeave={
                    handleDragLeave
                  }
                  onDrop={
                    handleDrop
                  }
                >

                  <input
                    ref={
                      fileInputRef
                    }
                    type="file"
                    multiple
                    hidden
                    onChange={
                      handleFileSelect
                    }
                  />

                  <div className="drop-icon">
                    ↑
                  </div>

                  {files.length ===
                  0 ? (

                    <>

                      <strong>
                        Drop files here
                      </strong>

                      <span>
                        or click to browse your device
                      </span>

                      <small>
                        Up to 10 files • 50 MB total
                      </small>

                    </>

                  ) : (

                    <>

                      <strong>
                        {files.length ===
                        1
                          ? files[0]
                              .name
                          : `${files.length} files selected`}
                      </strong>

                      <span>
                        {formatBytes(
                          totalSelectedSize
                        )}
                      </span>

                      <small>
                        Click to change files
                      </small>

                    </>

                  )}

                </label>

                {files.length >
                  0 && (

                  <div className="selected-files">

                    {files
                      .slice(
                        0,
                        4
                      )
                      .map(
                        (
                          item,
                          index
                        ) => (

                          <div
                            className="selected-file"
                            key={`${item.name}-${index}`}
                          >

                            <span>
                              ✓
                            </span>

                            <strong
                              title={
                                item.name
                              }
                            >
                              {
                                item.name
                              }
                            </strong>

                            <small>
                              {formatBytes(
                                item.size
                              )}
                            </small>

                          </div>

                        )
                      )}

                    {files.length >
                      4 && (

                      <div className="more-files">
                        +
                        {files.length -
                          4}{" "}
                        more files
                      </div>

                    )}

                  </div>

                )}

                {uploading && (

                  <div className="progress-panel">

                    <div className="progress-header">

                      <span>
                        {uploadStage ||
                          "Uploading..."}
                      </span>

                      <strong>
                        {
                          uploadProgress
                        }
                        %
                      </strong>

                    </div>

                    <div className="progress-track">

                      <div
                        className="progress-fill"
                        style={{
                          width: `${uploadProgress}%`,
                        }}
                      />

                    </div>

                    <div className="progress-detail">
                      {files.length >
                      1
                        ? "Creating and uploading ZIP"
                        : "Uploading securely"}
                    </div>

                  </div>

                )}

                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    !files.length ||
                    uploading
                  }
                  onClick={
                    uploadFiles
                  }
                >

                  {uploading
                    ? `${uploadProgress}%`
                    : files.length >
                      1
                    ? `Upload ${files.length} files`
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
                          files.length >
                          1
                            ? `${files.length} files`
                            : files[0]?.name
                        }
                      >
                        {files.length >
                        1
                          ? `${files.length} files • ZIP archive`
                          : files[0]?.name}
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
                        {formatTime(
                          remainingSeconds
                        )}
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
                      Opens a secure download page
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

            {downloading && (

              <div className="download-progress-panel">

                <div className="progress-header">

                  <span>
                    Downloading
                  </span>

                  <strong>
                    {downloadProgress}%
                  </strong>

                </div>

                <div className="progress-track">

                  <div
                    className="progress-fill download-fill"
                    style={{
                      width: `${downloadProgress}%`,
                    }}
                  />

                </div>

                <div className="progress-detail">

                  {formatBytes(
                    downloadedBytes
                  )}

                  {" / "}

                  {downloadTotal
                    ? formatBytes(
                        downloadTotal
                      )
                    : "Calculating..."}

                </div>

              </div>

            )}

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
                ? `${downloadProgress}%`
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
