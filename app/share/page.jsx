"use client";

import {
  useEffect,
  useState,
} from "react";

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const FUNCTION_URL =
  `${SUPABASE_URL}/functions/v1/transfer-v2`;

const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

function formatBytes(bytes) {
  if (!bytes) return "Unknown size";

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

export default function SharePage() {
  const [code, setCode] =
    useState("");

  const [meta, setMeta] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [downloading, setDownloading] =
    useState(false);

  const [progress, setProgress] =
    useState(0);

  const [downloadedBytes, setDownloadedBytes] =
    useState(0);

  const [downloadTotal, setDownloadTotal] =
    useState(0);

  const [remainingSeconds, setRemainingSeconds] =
    useState(0);

  const [error, setError] =
    useState("");

  const [done, setDone] =
    useState(false);

  /* =====================================================
     LOAD TRANSFER
  ===================================================== */

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const transferCode =
      params.get("code");

    if (
      !transferCode ||
      !/^\d{5}$/.test(
        transferCode
      )
    ) {
      setError(
        "Invalid transfer link."
      );

      setLoading(false);

      return;
    }

    setCode(
      transferCode
    );

    const load =
      async () => {
        try {
          const response =
            await fetch(
              FUNCTION_URL,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    action:
                      "preview-download",

                    code:
                      transferCode,
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

          setMeta(
            data
          );

          updateTimer(
            data.expiresAt
          );
        } catch (err) {
          setError(
            err?.message ||
              "Unable to find this file."
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    load();
  }, []);

  /* =====================================================
     TIMER
  ===================================================== */

  const updateTimer =
    (expiresAt) => {
      const tick =
        () => {
          const remaining =
            Math.max(
              0,
              new Date(
                expiresAt
              ).getTime() -
                Date.now()
            );

          setRemainingSeconds(
            Math.ceil(
              remaining / 1000
            )
          );
        };

      tick();

      const interval =
        setInterval(
          tick,
          1000
        );

      return () =>
        clearInterval(
          interval
        );
    };

  /* =====================================================
     DOWNLOAD
  ===================================================== */

  const downloadFile =
    async () => {
      if (
        !code ||
        downloading
      ) {
        return;
      }

      setDownloading(
        true
      );

      setProgress(
        0
      );

      setDownloadedBytes(
        0
      );

      setDownloadTotal(
        0
      );

      setError("");

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

              body:
                JSON.stringify({
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
              "File is no longer available."
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
            "Download failed."
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

          while (true) {
            const {
              done: streamDone,
              value,
            } =
              await reader.read();

            if (
              streamDone
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
              total > 0
            ) {
              setProgress(
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

        setProgress(
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

        /* DELETE AFTER COMPLETE DOWNLOAD */

        await fetch(
          FUNCTION_URL,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "complete-download",

                id:
                  data.id,
              }),
          }
        );

        setDone(
          true
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
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <main className="share-page dark">

        <div className="share-card">

          <div className="share-logo">
            H
          </div>

          <h1>
            HoneyShare
          </h1>

          <p>
            Checking your secure transfer...
          </p>

          <div className="share-spinner" />

        </div>

      </main>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (error) {
    return (
      <main className="share-page dark">

        <div className="share-card">

          <div className="share-logo">
            H
          </div>

          <h1>
            HoneyShare
          </h1>

          <div className="share-error">
            {error}
          </div>

          <a
            className="share-home-button"
            href="/"
          >
            Go to HoneyShare
          </a>

        </div>

      </main>
    );
  }

  /* =====================================================
     DONE
  ===================================================== */

  if (done) {
    return (
      <main className="share-page dark">

        <div className="share-card">

          <div className="share-success-icon">
            ✓
          </div>

          <h1>
            Download complete
          </h1>

          <p>
            The file has been downloaded
            and removed automatically.
          </p>

          <a
            className="share-home-button"
            href="/"
          >
            Share another file
          </a>

        </div>

      </main>
    );
  }

  /* =====================================================
     MAIN
  ===================================================== */

  return (
    <main className="share-page dark">

      <div className="share-card">

        <div className="share-brand">

          <div className="share-logo">
            H
          </div>

          <div>

            <strong>
              HoneyShare
            </strong>

            <span>
              Fast. Simple. Temporary.
            </span>

          </div>

        </div>

        <div className="share-badge">
          SECURE FILE TRANSFER
        </div>

        <h1>
          File ready to download
        </h1>

        <p className="share-subtitle">
          Someone shared a temporary file
          with you.
        </p>

        <div className="share-file-card">

          <div className="share-file-icon">
            📄
          </div>

          <div className="share-file-info">

            <strong
              title={
                meta?.fileName
              }
            >
              {
                meta?.fileName
              }
            </strong>

            <span>
              {formatBytes(
                meta?.fileSize
              )}
            </span>

          </div>

        </div>

        <div className="share-code">

          <span>
            TRANSFER CODE
          </span>

          <strong>
            {code}
          </strong>

        </div>

        <div className="share-expiry">

          ⌛ Expires in{" "}

          <strong>
            {formatTime(
              remainingSeconds
            )}
          </strong>

        </div>

        {downloading && (

          <div className="share-download-progress">

            <div className="share-progress-header">

              <span>
                Downloading file
              </span>

              <strong>
                {progress}%
              </strong>

            </div>

            <div className="share-progress-track">

              <div
                className="share-progress-fill"
                style={{
                  width: `${progress}%`,
                }}
              />

            </div>

            <small>

              {formatBytes(
                downloadedBytes
              )}

              {" / "}

              {downloadTotal
                ? formatBytes(
                    downloadTotal
                  )
                : "Calculating..."}

            </small>

          </div>

        )}

        <button
          type="button"
          className="share-download-button"
          onClick={
            downloadFile
          }
          disabled={
            downloading
          }
        >

          {downloading
            ? `Downloading ${progress}%`
            : "Download File"}

          {!downloading && (
            <span>
              ↓
            </span>
          )}

        </button>

        <p className="share-note">
          The file is automatically deleted
          after the download completes.
        </p>

      </div>

    </main>
  );
}
