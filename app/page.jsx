"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  QRCodeCanvas,
} from "qrcode.react";

import JSZip from "jszip";

import * as tus from "tus-js-client";


/* =====================================================
   CONFIG
===================================================== */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
   EDGE FUNCTION
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
   HELPERS
===================================================== */

function formatBytes(
  bytes
) {
  if (!bytes) {
    return "0 B";
  }

  if (
    bytes <
    1024
  ) {
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


function formatTime(
  seconds
) {
  const minutes =
    Math.floor(
      seconds / 60
    );

  const remaining =
    seconds % 60;

  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    remaining
  ).padStart(
    2,
    "0"
  )}`;
}


/* =====================================================
   HOME
===================================================== */

export default function Home() {

  /* ===================================================
     THEME
  =================================================== */

  const [
    theme,
    setTheme,
  ] = useState(
    "dark"
  );


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
  ] = useState(
    false
  );


  /* ===================================================
     UPLOAD
  =================================================== */

  const [
    uploading,
    setUploading,
  ] = useState(
    false
  );

  const [
    uploadProgress,
    setUploadProgress,
  ] = useState(
    0
  );

  const [
    uploadStage,
    setUploadStage,
  ] = useState(
    ""
  );

  const [
    uploadedBytes,
    setUploadedBytes,
  ] = useState(
    0
  );

  const [
    uploadTotalBytes,
    setUploadTotalBytes,
  ] = useState(
    0
  );


  /* ===================================================
     TRANSFER
  =================================================== */

  const [
    transferCode,
    setTransferCode,
  ] = useState(
    ""
  );

  const [
    expiresAt,
    setExpiresAt,
  ] = useState(
    null
  );

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState(
    0
  );


  /* ===================================================
     DOWNLOAD
  =================================================== */

  const [
    receiveCode,
    setReceiveCode,
  ] = useState(
    ""
  );

  const [
    downloading,
    setDownloading,
  ] = useState(
    false
  );

  const [
    downloadProgress,
    setDownloadProgress,
  ] = useState(
    0
  );

  const [
    downloadedBytes,
    setDownloadedBytes,
  ] = useState(
    0
  );

  const [
    downloadTotal,
    setDownloadTotal,
  ] = useState(
    0
  );


  /* ===================================================
     UI
  =================================================== */

  const [
    message,
    setMessage,
  ] = useState(
    ""
  );

  const [
    error,
    setError,
  ] = useState(
    ""
  );

  const [
    origin,
    setOrigin,
  ] = useState(
    ""
  );


  /* ===================================================
     LIVE USERS
  =================================================== */

  const [
    liveUsers,
    setLiveUsers,
  ] = useState(
    0
  );


  /* ===================================================
     REFS
  =================================================== */

  const fileInputRef =
    useRef(null);

  const presenceChannelRef =
    useRef(null);


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
      savedTheme ===
        "dark" ||
      savedTheme ===
        "light"
    ) {
      setTheme(
        savedTheme
      );
    }


    const visitorId =
      getVisitorId();


    /* ---------------------------------------------
       VISITOR ANALYTICS
    --------------------------------------------- */

    const recordVisitor =
      async () => {
        try {

          const {
            error:
              visitorError,
          } =
            await supabase.rpc(
              "record_visitor",
              {
                p_visitor_id:
                  visitorId,
              }
            );

          if (
            visitorError
          ) {
            console.error(
              "Visitor tracking error:",
              visitorError
            );
          }

        } catch (
          err
        ) {
          console.error(
            "Visitor tracking error:",
            err
          );
        }
      };


    recordVisitor();


    /* ---------------------------------------------
       REALTIME PRESENCE
    --------------------------------------------- */

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

        const count =
          Object.keys(
            state || {}
          ).length;

        setLiveUsers(
          count
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

          } catch (
            err
          ) {
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


  /* ===================================================
     TIMER
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

          setTransferCode(
            ""
          );

          setExpiresAt(
            null
          );

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

  }, [
    expiresAt,
  ]);


  /* ===================================================
     THEME
  =================================================== */

  const toggleTheme =
    () => {

      const next =
        theme ===
        "dark"
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
     FILE VALIDATION
  =================================================== */

  const validateFiles =
    (
      incoming
    ) => {

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
            sum,
            item
          ) =>
            sum +
            item.size,
          0
        );


      const oversized =
        selected.some(
          (
            item
          ) =>
            item.size >
            MAX_FILE_SIZE
        );


      if (
        oversized
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
    (
      event
    ) => {

      validateFiles(
        event.target.files
      );

    };


  /* ===================================================
     REMOVE SINGLE FILE
  =================================================== */

  const removeFile =
    (
      indexToRemove
    ) => {

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
    (
      event
    ) => {

      event.preventDefault();

      setDragActive(
        true
      );

    };


  const handleDragLeave =
    (
      event
    ) => {

      event.preventDefault();

      setDragActive(
        false
      );

    };


  const handleDrop =
    (
      event
    ) => {

      event.preventDefault();

      setDragActive(
        false
      );

      validateFiles(
        event.dataTransfer.files
      );

    };


  /* ===================================================
     ZIP PREPARATION
  =================================================== */

  const prepareUploadFile =
    async () => {

      if (
        files.length ===
        1
      ) {

        setUploadTotalBytes(
          files[0].size
        );

        return files[0];
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
        totalSelectedSize
      );


      const zip =
        new JSZip();


      files.forEach(
        (
          item
        ) => {

          zip.file(
            item.name,
            item
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

            const percent =
              Math.round(
                metadata.percent
              );

            setUploadProgress(
              percent
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
     ANONYMOUS ACCESS TOKEN
  =================================================== */

  const ensureAnonymousAccessToken =
    async () => {

      const {
        data:
          sessionData,
      } =
        await supabase.auth.getSession();


      if (
        sessionData
          ?.session
          ?.access_token
      ) {

        return (
          sessionData
            .session
            .access_token
        );

      }


      const {
        data,
        error:
          signInError,
      } =
        await supabase.auth.signInAnonymously();


      if (
        signInError
      ) {

        throw new Error(
          "Anonymous sign-in is not enabled in Supabase."
        );

      }


      const accessToken =
        data
          ?.session
          ?.access_token;


      if (
        !accessToken
      ) {

        throw new Error(
          "Supabase did not return an anonymous access token."
        );

      }


      return accessToken;

    };


  /* ===================================================
     TUS UPLOAD
  =================================================== */

  const uploadToTusWithProgress =
    async (
      uploadFile,
      token,
      accessToken
    ) => {

      return new Promise(
        (
          resolve,
          reject
        ) => {

          const hostname =
            new URL(
              SUPABASE_URL
            ).hostname;


          const projectRef =
            hostname.split(
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

                  authorization:
                    `Bearer ${accessToken}`,

                  "x-signature":
                    token,

                  "x-upsert":
                    "false",

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


                metadata: {

                  bucketName:
                    "temporary-files",

                  objectName:
                    uploadFile.name,

                  contentType:
                    uploadFile.type ||
                    "application/octet-stream",

                  cacheControl:
                    "3600",

                },


                onError:
                  (
                    uploadError
                  ) => {

                    console.error(
                      "TUS upload error:",
                      uploadError
                    );

                    reject(
                      uploadError
                    );

                  },


                onProgress:
                  (
                    bytesUploadedNow,
                    bytesTotalNow
                  ) => {

                    const percent =
                      bytesTotalNow >
                      0
                        ? Math.min(
                            100,
                            Math.round(
                              (bytesUploadedNow /
                                bytesTotalNow) *
                                100
                            )
                          )
                        : 0;


                    setUploadedBytes(
                      bytesUploadedNow
                    );


                    setUploadTotalBytes(
                      bytesTotalNow
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

                  },

              }
            );


          upload
            .findPreviousUploads()
            .then(
              (
                previousUploads
              ) => {

                if (
                  previousUploads.length
                ) {

                  upload.resumeFromPreviousUpload(
                    previousUploads[0]
                  );

                }


                upload.start();

              }
            )
            .catch(
              reject
            );

        }
      );

    };


  /* ===================================================
     SIGNED URL FALLBACK

     IMPORTANT:
     This uses XMLHttpRequest so that the browser
     provides real upload progress events.
  =================================================== */

  const uploadToSignedUrlFallback =
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

            const baseUrl =
              SUPABASE_URL.replace(
                /\/$/,
                ""
              );


            const cleanPath =
              String(
                path || ""
              )
                .split(
                  "/"
                )
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


            const uploadUrl =
              `${baseUrl}/storage/v1/object/upload/sign/${cleanPath}?token=${encodeURIComponent(
                token
              )}`;


            const xhr =
              new XMLHttpRequest();


            xhr.open(
              "POST",
              uploadUrl,
              true
            );


            xhr.setRequestHeader(
              "x-upsert",
              "false"
            );


            const formData =
              new FormData();


            formData.append(
              "cacheControl",
              "3600"
            );


            /*
              Supabase uploadToSignedUrl uses an empty
              FormData field name for the file body.
            */
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


            xhr.upload.onprogress =
              (
                event
              ) => {

                if (
                  !event.lengthComputable
                ) {
                  return;
                }


                const percent =
                  Math.min(
                    100,
                    Math.round(
                      (event.loaded /
                        event.total) *
                        100
                    )
                  );


                setUploadedBytes(
                  event.loaded
                );


                setUploadTotalBytes(
                  event.total
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


                reject(
                  new Error(
                    `Upload failed (${xhr.status}): ${
                      xhr.responseText ||
                      "Unknown error"
                    }`
                  )
                );

              };


            xhr.onerror =
              () => {

                reject(
                  new Error(
                    "Network error while uploading file."
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

            reject(
              err
            );

          }

        }
      );

    };


  /* ===================================================
     UPLOAD ROUTER
  =================================================== */

  const uploadWithProgress =
    async (
      uploadFile,
      path,
      token
    ) => {

      try {

        const accessToken =
          await ensureAnonymousAccessToken();


        await uploadToTusWithProgress(
          uploadFile,
          token,
          accessToken
        );


        return;

      } catch (
        tusError
      ) {

        console.warn(
          "TUS failed. Falling back to XHR signed upload:",
          tusError
        );

      }


      await uploadToSignedUrlFallback(
        uploadFile,
        path,
        token
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

        /* -------------------------------------------
           PREPARE
        ------------------------------------------- */

        const uploadFile =
          await prepareUploadFile();


        setUploadTotalBytes(
          uploadFile.size
        );


        setUploadedBytes(
          0
        );


        /* -------------------------------------------
           CREATE TRANSFER
        ------------------------------------------- */

        setUploadStage(
          "Creating secure transfer..."
        );


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
          !initData.token
        ) {

          throw new Error(
            "Server did not return a signed upload token."
          );

        }


        /* -------------------------------------------
           UPLOAD
        ------------------------------------------- */

        setUploadProgress(
          0
        );


        setUploadStage(
          "Uploading 0%"
        );


        await uploadWithProgress(
          uploadFile,
          initData.path,
          initData.token
        );


        /* -------------------------------------------
           FINALIZE
        ------------------------------------------- */

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


        /* -------------------------------------------
           SUCCESS
        ------------------------------------------- */

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


      } catch (
        err
      ) {

        console.error(
          "Upload error:",
          err
        );


        setError(
          err?.message ||
            "Upload failed. Please try again."
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


        const url =
          URL.createObjectURL(
            blob
          );


        const link =
          document.createElement(
            "a"
          );


        link.href =
          url;


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
              url
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


      } catch (
        err
      ) {

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
      ? `${origin}/share?code=${transferCode}`
      : "";


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


      setUploadStage(
        ""
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


  /* ===================================================
     TOTAL SIZE
  =================================================== */

  const totalSelectedSize =
    files.reduce(
      (
        sum,
        file
      ) =>
        sum +
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


        {/* TRANSFER GRID */}

        <div className="transfer-grid">

          {/* SEND */}

          <section className="card">

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


                {/* FILE LIST */}

                {files.length >
                  0 && (

                  <div className="selected-files">

                    {files.map(
                      (
                        item,
                        index
                      ) => (

                        <div
                          className="selected-file"
                          key={`${item.name}-${item.lastModified}-${index}`}
                        >

                          <span className="file-check">
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


                          <button
                            type="button"
                            className="remove-file-button"
                            aria-label={`Remove ${item.name}`}
                            title="Remove file"
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
                        {uploadProgress}%
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

                      {formatBytes(
                        uploadedBytes
                      )}

                      {" / "}

                      {formatBytes(
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

              /* =====================================
                 UPLOADED STATE
              ===================================== */

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
                      Opens secure download page
                    </span>

                  </div>

                </div>

              </div>

            )}

          </section>


          {/* RECEIVE */}

          <section className="card">

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
                    }
                    %
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
