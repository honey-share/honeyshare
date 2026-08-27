"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { createClient } from "@supabase/supabase-js";
import { QRCodeCanvas } from "qrcode.react";
import JSZip from "jszip";

/* =====================================================
   CONFIG
===================================================== */

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

const TRANSFER_SECONDS = 5 * 60;

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

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
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
    Math.floor(seconds / 60);

  const remaining =
    seconds % 60;

  return `${String(
    minutes
  ).padStart(2, "0")}:${String(
    remaining
  ).padStart(2, "0")}`;
}

function getVisitorId() {
  try {
    let visitorId =
      localStorage.getItem(
        VISITOR_STORAGE_KEY
      );

    if (!visitorId) {
      visitorId =
        typeof crypto !==
          "undefined" &&
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
   TRANSFER FUNCTION
===================================================== */

async function callTransferFunction(
  action,
  payload = {}
) {
  const {
    data,
    error,
  } =
    await supabase.functions.invoke(
      "transfer-v2",
      {
        body: {
          action,
          ...payload,
        },
      }
    );

  if (error) {
    console.error(
      "transfer-v2 error:",
      error
    );

    throw new Error(
      error.message ||
        "Unable to contact HoneyShare server."
    );
  }

  if (data?.error) {
    throw new Error(
      data.error
    );
  }

  return data;
}

/* =====================================================
   MAIN
===================================================== */

export default function Home() {
  /* ===================================================
     THEME
  =================================================== */

  const [
    theme,
    setTheme,
  ] = useState("dark");

  /* ===================================================
     FILES
  =================================================== */

  const [
    files,
    setFiles,
  ] = useState([]);

  const [
    dragActive,
    setDragActive,
  ] = useState(false);

  /* ===================================================
     UPLOAD
  =================================================== */

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    uploadProgress,
    setUploadProgress,
  ] = useState(0);

  const [
    uploadStage,
    setUploadStage,
  ] = useState("");

  const [
    uploadedBytes,
    setUploadedBytes,
  ] = useState(0);

  const [
    uploadTotalBytes,
    setUploadTotalBytes,
  ] = useState(0);

  /* ===================================================
     TRANSFER
  =================================================== */

  const [
    transferCode,
    setTransferCode,
  ] = useState("");

  const [
    expiresAt,
    setExpiresAt,
  ] = useState(null);

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState(0);

  /* ===================================================
     DOWNLOAD
  =================================================== */

  const [
    receiveCode,
    setReceiveCode,
  ] = useState("");

  const [
    downloading,
    setDownloading,
  ] = useState(false);

  const [
    downloadProgress,
    setDownloadProgress,
  ] = useState(0);

  const [
    downloadedBytes,
    setDownloadedBytes,
  ] = useState(0);

  const [
    downloadTotal,
    setDownloadTotal,
  ] = useState(0);

  /* ===================================================
     UI
  =================================================== */

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    origin,
    setOrigin,
  ] = useState("");

  /* ===================================================
     LIVE USERS
  =================================================== */

  const [
    liveUsers,
    setLiveUsers,
  ] = useState(0);

  /* ===================================================
     REFS
  =================================================== */

  const fileInputRef =
    useRef(null);

  const presenceChannelRef =
    useRef(null);

  const qrAttempted =
    useRef(false);

  /* ===================================================
     INITIALIZATION
  =================================================== */

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
      setTheme(
        savedTheme
      );
    }

    /* -----------------------------------------------
       ANALYTICS
    ------------------------------------------------ */

    const initializeAnalytics =
      async () => {
        const visitorId =
          getVisitorId();

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
            "Visitor tracking error:",
            err
          );
        }
      };

    initializeAnalytics();

    /* -----------------------------------------------
       LIVE USERS
    ------------------------------------------------ */

    const visitorId =
      getVisitorId();

    const channel =
      supabase.channel(
        PRESENCE_CHANNEL,
        {
          config: {
            presence: {
              key:
                visitorId,
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
        event:
          "sync",
      },
      updateLiveUsers
    );

    channel.on(
      "presence",
      {
        event:
          "join",
      },
      updateLiveUsers
    );

    channel.on(
      "presence",
      {
        event:
          "leave",
      },
      updateLiveUsers
    );

    channel.subscribe(
      async (
        status
      ) => {
        if (
          status ===
          "SUBSCRIBED"
        ) {
          try {
            await channel.track(
              {
                visitor_id:
                  visitorId,

                online_at:
                  new Date().toISOString(),
              }
            );

            updateLiveUsers();
          } catch (err) {
            console.error(
              "Presence error:",
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

  /* ===================================================
     EXPIRY TIMER
  =================================================== */

  useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(
        0
      );

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
            remaining /
              1000
          );

        setRemainingSeconds(
          seconds
        );

        if (
          seconds <=
          0
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

  /* ===================================================
     THEME
  =================================================== */

  const toggleTheme =
    () => {
      const next =
        theme === "dark"
          ? "light"
          : "dark";

      setTheme(
        next
      );

      localStorage.setItem(
        "honeyshare-theme",
        next
      );
    };

  /* ===================================================
     VALIDATE FILES
  =================================================== */

  const validateFiles =
    (incoming) => {
      const selected =
        Array.from(
          incoming || []
        );

      setError("");
      setMessage("");

      if (
        !selected.length
      ) {
        return;
      }

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
          (
            total,
            file
          ) =>
            total +
            file.size,
          0
        );

      const hasOversized =
        selected.some(
          (
            file
          ) =>
            file.size >
            MAX_FILE_SIZE
        );

      if (
        hasOversized
      ) {
        setError(
          "One of the files is larger than the 50 MB limit."
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

  /* ===================================================
     FILE SELECT
  =================================================== */

  const handleFileSelect =
    (event) => {
      validateFiles(
        event.target.files
      );
    };

  /* ===================================================
     REMOVE FILE
  =================================================== */

  const removeFile =
    (indexToRemove) => {
      setFiles(
        (
          currentFiles
        ) =>
          currentFiles.filter(
            (
              _,
              index
            ) =>
              index !==
              indexToRemove
          )
      );

      setError("");
      setMessage("");

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    };

  /* ===================================================
     DRAG & DROP
  =================================================== */

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
        event.dataTransfer.files
      );
    };

  /* ===================================================
     ZIP
  =================================================== */

  const prepareUploadFile =
    async () => {
      if (
        files.length ===
        1
      ) {
        const file =
          files[0];

        setUploadTotalBytes(
          file.size
        );

        return file;
      }

      setUploadStage(
        "Preparing ZIP..."
      );

      setUploadProgress(
        0
      );

      setUploadedBytes(
        0
      );

      setUploadTotalBytes(
        files.reduce(
          (
            total,
            file
          ) =>
            total +
            file.size,
          0
        )
      );

      const zip =
        new JSZip();

      files.forEach(
        (
          file
        ) => {
          zip.file(
            file.name,
            file
          );
        }
      );

      const blob =
        await zip.generateAsync(
          {
            type:
              "blob",

            compression:
              "STORE",

            streamFiles:
              true,
          },

          (
            metadata
          ) => {
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
          "Generated ZIP is larger than the 50 MB limit."
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

  /* ===================================================
     SIGNED UPLOAD WITH REAL PROGRESS

     Same backend signed-upload flow.
     No anonymous authentication.
     No RLS changes.
  =================================================== */

  const uploadToSignedUrlWithProgress =
    async (
      uploadFile,
      path,
      token
    ) => {
      return new Promise(
        (
          resolve,
          reject
        ) => {
          try {
            if (
              !SUPABASE_URL
            ) {
              reject(
                new Error(
                  "Missing Supabase URL."
                )
              );

              return;
            }

            if (
              !token
            ) {
              reject(
                new Error(
                  "Missing signed upload token."
                )
              );

              return;
            }

            /*
              IMPORTANT:
              Do not prepend bucket here.

              Your transfer-v2 function already returns
              the correct signed upload path.
            */

            const baseUrl =
              SUPABASE_URL.replace(
                /\/$/,
                ""
              );

            const cleanPath =
              String(
                path
              )
                .split(
                  "/"
                )
                .filter(Boolean)
                .map(
                  (
                    part
                  ) =>
                    encodeURIComponent(
                      part
                    )
                )
                .join(
                  "/"
                );

            const signedUploadUrl =
              `${baseUrl}/storage/v1/object/upload/sign/${cleanPath}?token=${encodeURIComponent(
                token
              )}`;

            const xhr =
              new XMLHttpRequest();

            /*
              Supabase signed upload uses POST for the
              browser request generated by storage-js.
            */

            xhr.open(
              "POST",
              signedUploadUrl,
              true
            );

            /*
              Do NOT add Authorization or apikey here.
              The signed token in the URL is used by
              Supabase Storage.
            */

            const formData =
              new FormData();

            formData.append(
              "cacheControl",
              "3600"
            );

            formData.append(
              "",
              uploadFile
            );

            setUploadedBytes(
              0
            );

            setUploadTotalBytes(
              uploadFile.size
            );

            setUploadProgress(
              0
            );

            setUploadStage(
              "Uploading 0%"
            );

            /*
              REAL BROWSER UPLOAD PROGRESS
            */

            xhr.upload.onprogress =
              (
                event
              ) => {
                if (
                  !event.lengthComputable
                ) {
                  return;
                }

                const loaded =
                  event.loaded;

                const total =
                  event.total ||
                  uploadFile.size;

                const percent =
                  total > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (loaded /
                            total) *
                            100
                        )
                      )
                    : 0;

                setUploadedBytes(
                  loaded
                );

                setUploadTotalBytes(
                  total
                );

                setUploadProgress(
                  percent
                );

                setUploadStage(
                  `Uploading ${percent}%`
                );
              };

            xhr.onload =
              () => {
                if (
                  xhr.status >=
                    200 &&
                  xhr.status <
                    300
                ) {
                  setUploadedBytes(
                    uploadFile.size
                  );

                  setUploadTotalBytes(
                    uploadFile.size
                  );

                  setUploadProgress(
                    100
                  );

                  setUploadStage(
                    "Upload complete"
                  );

                  resolve();

                  return;
                }

                let details =
                  xhr.responseText ||
                  "Unknown upload error.";

                try {
                  const parsed =
                    JSON.parse(
                      xhr.responseText
                    );

                  if (
                    parsed?.message
                  ) {
                    details =
                      parsed.message;
                  }
                } catch {
                  /* Keep raw response */
                }

                reject(
                  new Error(
                    `Upload failed (${xhr.status}): ${details}`
                  )
                );
              };

            xhr.onerror =
              () => {
                reject(
                  new Error(
                    "Network error while uploading the file."
                  )
                );
              };

            xhr.onabort =
              () => {
                reject(
                  new Error(
                    "Upload was cancelled."
                  )
                );
              };

            xhr.send(
              formData
            );
          } catch (
            err
          ) {
            reject(err);
          }
        }
      );
    };

  /* ===================================================
     UPLOAD
  =================================================== */

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

      setUploadedBytes(
        0
      );

      setUploadTotalBytes(
        0
      );

      setUploadStage(
        "Starting..."
      );

      setError("");
      setMessage("");

      try {
        /*
          Create original file or ZIP.
        */

        const uploadFile =
          await prepareUploadFile();

        /*
          Reset network progress after ZIP creation.
        */

        setUploadedBytes(
          0
        );

        setUploadTotalBytes(
          uploadFile.size
        );

        setUploadProgress(
          0
        );

        setUploadStage(
          "Creating secure transfer..."
        );

        /*
          IMPORTANT:
          Same working transfer-v2 init.
        */

        const initData =
          await callTransferFunction(
            "init-upload",
            {
              fileName:
                uploadFile.name,

              fileSize:
                uploadFile.size,

              mimeType:
                uploadFile.type ||
                "application/octet-stream",
            }
          );

        if (
          !initData?.token
        ) {
          throw new Error(
            "Server did not return a signed upload token."
          );
        }

        if (
          !initData?.path
        ) {
          throw new Error(
            "Server did not return an upload path."
          );
        }

        /*
          REAL UPLOAD
        */

        await uploadToSignedUrlWithProgress(
          uploadFile,
          initData.path,
          initData.token
        );

        /*
          ACTIVATE
        */

        setUploadStage(
          "Finalizing..."
        );

        await callTransferFunction(
          "activate-upload",
          {
            code:
              initData.code,
          }
        );

        /*
          SUCCESS
        */

        setTransferCode(
          initData.code
        );

        setExpiresAt(
          initData.expiresAt
        );

        setRemainingSeconds(
          TRANSFER_SECONDS
        );

        setUploadedBytes(
          uploadFile.size
        );

        setUploadTotalBytes(
          uploadFile.size
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
        console.error(
          "Upload error:",
          err
        );

        setError(
          err?.message ||
            "Upload failed. Please try again."
        );

        setTransferCode(
          ""
        );

        setExpiresAt(
          null
        );

        setRemainingSeconds(
          0
        );
      } finally {
        setUploading(
          false
        );
      }
    };

  /* ===================================================
     DOWNLOAD
  =================================================== */

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
        const data =
          await callTransferFunction(
            "prepare-download",
            {
              code,
            }
          );

        if (
          !data?.url
        ) {
          throw new Error(
            "Server did not return a download URL."
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

        let received =
          0;

        if (
          response.body
        ) {
          const reader =
            response.body.getReader();

          while (
            true
          ) {
            const {
              done,
              value,
            } =
              await reader.read();

            if (
              done
            ) {
              break;
            }

            chunks.push(
              value
            );

            received +=
              value.byteLength;

            setDownloadedBytes(
              received
            );

            if (
              total >
              0
            ) {
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

        await callTransferFunction(
          "complete-download",
          {
            id:
              data.id,
          }
        );

        setReceiveCode(
          ""
        );

        setMessage(
          "Download complete. File deleted automatically."
        );
      } catch (err) {
        console.error(
          "Download error:",
          err
        );

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

  /* ===================================================
     QR
  =================================================== */

  const qrValue =
    origin &&
    transferCode
      ? `${origin}/?code=${transferCode}`
      : "";


  /* ===================================================
     QR AUTO DOWNLOAD
  =================================================== */

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


  /* ===================================================
     RESET
  =================================================== */

  const resetUpload =
    () => {

      setFiles([]);

      setTransferCode("");

      setExpiresAt(
        null
      );

      setRemainingSeconds(
        0
      );

      setUploadProgress(
        0
      );

      setUploadedBytes(
        0
      );

      setUploadTotalBytes(
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


  /* ===================================================
     TOTAL SIZE
  =================================================== */

  const totalSelectedSize =
    files.reduce(
      (
        total,
        file
      ) =>
        total +
        file.size,
      0
    );


  /* ===================================================
     UI
  =================================================== */

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

            <img
              src="/honeyshare.svg"
              alt="HoneyShare"
              className="brand-logo-image"
            />

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


        {/* CARDS */}

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

                {/* DROP ZONE */}

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

                      <strong
                        title={
                          files.length ===
                          1
                            ? files[0]
                                .name
                            : `${files.length} files selected`
                        }
                      >

                        {files.length ===
                        1
                          ? files[0]
                              .name
                          : `${files.length} files selected`}

                      </strong>


                      <span>
                        {formatFileSize(
                          totalSelectedSize
                        )}
                      </span>


                      <small>
                        Click to change files
                      </small>

                    </>

                  )}

                </label>


                {/* FILE LIST */}

                {files.length >
                  0 && (

                  <div className="selected-files">

                    {files.map(
                      (
                        file,
                        index
                      ) => (

                        <div
                          className="selected-file"
                          key={`${file.name}-${file.lastModified}-${index}`}
                        >

                          <span className="file-check">
                            ✓
                          </span>


                          <strong
                            title={
                              file.name
                            }
                          >
                            {
                              file.name
                            }
                          </strong>


                          <small>
                            {formatFileSize(
                              file.size
                            )}
                          </small>


                          <button
                            type="button"
                            className="remove-file-button"
                            title="Remove file"
                            aria-label={`Remove ${file.name}`}
                            onClick={(
                              event
                            ) => {

                              event.preventDefault();

                              event.stopPropagation();

                              removeFile(
                                index
                              );

                            }}
                          >
                            ×
                          </button>

                        </div>

                      )
                    )}

                  </div>

                )}


                {/* UPLOAD PROGRESS */}

                {uploading && (

                  <div className="progress-panel">

                    <div className="progress-header">

                      <span>
                        {uploadStage}
                      </span>


                      <strong>
                        {
                          uploadProgress
                        }%
                      </strong>

                    </div>


                    <div className="progress-track">

                      <div
                        className="progress-fill"
                        style={{
                          width:
                            `${uploadProgress}%`,
                        }}
                      />

                    </div>


                    <div className="progress-detail">

                      {formatFileSize(
                        uploadedBytes
                      )}

                      {" / "}

                      {formatFileSize(
                        uploadTotalBytes
                      )}

                    </div>

                  </div>

                )}


                {/* UPLOAD BUTTON */}

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

              /* UPLOADED STATE */

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
                          size={
                            180
                          }
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
                maxLength={
                  5
                }
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


            {/* DOWNLOAD PROGRESS */}

            {downloading && (

              <div className="download-progress-panel">

                <div className="progress-header">

                  <span>
                    Downloading
                  </span>


                  <strong>
                    {
                      downloadProgress
                    }%
                  </strong>

                </div>


                <div className="progress-track">

                  <div
                    className="progress-fill download-fill"
                    style={{
                      width:
                        `${downloadProgress}%`,
                    }}
                  />

                </div>


                <div className="progress-detail">

                  {formatFileSize(
                    downloadedBytes
                  )}

                  {" / "}

                  {downloadTotal
                    ? formatFileSize(
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
