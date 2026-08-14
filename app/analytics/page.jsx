"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const PRESENCE_CHANNEL =
  "honeyshare-live-users";

const VISITOR_STORAGE_KEY =
  "honeyshare-visitor-id";

/* =====================================================
   HELPERS
===================================================== */

function getVisitorId() {
  try {
    let id = localStorage.getItem(
      VISITOR_STORAGE_KEY
    );

    if (!id) {
      id =
        typeof crypto !== "undefined" &&
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
    return `visitor-${Date.now()}`;
  }
}

function getDateLabel(date) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "short",
      day: "numeric",
    }
  ).format(date);
}

/* =====================================================
   DASHBOARD
===================================================== */

export default function AnalyticsPage() {
  const [stats, setStats] =
    useState({
      today: 0,
      month: 0,
      total: 0,
    });

  const [liveUsers, setLiveUsers] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [lastUpdated, setLastUpdated] =
    useState(null);

  const [error, setError] =
    useState("");

  const [theme, setTheme] =
    useState("dark");

  /* =====================================================
     THEME
  ===================================================== */

  useEffect(() => {
    const saved =
      localStorage.getItem(
        "honeyshare-theme"
      );

    if (
      saved === "light" ||
      saved === "dark"
    ) {
      setTheme(saved);
    }
  }, []);

  const toggleTheme = () => {
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
     FETCH STATS
  ===================================================== */

  const fetchStats = async () => {
    try {
      setError("");

      const {
        data,
        error: rpcError,
      } = await supabase.rpc(
        "get_visitor_stats"
      );

      if (rpcError) {
        throw rpcError;
      }

      const result =
        Array.isArray(data)
          ? data[0]
          : data;

      setStats({
        today:
          Number(
            result?.today
          ) || 0,

        month:
          Number(
            result?.month
          ) || 0,

        total:
          Number(
            result?.total
          ) || 0,
      });

      setLastUpdated(
        new Date()
      );
    } catch (err) {
      console.error(
        "Analytics stats error:",
        err
      );

      setError(
        "Unable to load visitor statistics."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     LIVE USERS
  ===================================================== */

  useEffect(() => {
    const visitorId =
      getVisitorId();

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

    const updateLiveUsers =
      () => {
        const state =
          channel.presenceState();

        /*
          Each presence key represents
          an active browser/session.

          We count unique presence keys,
          not individual presence payloads.
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
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  /* =====================================================
     INITIAL + AUTO REFRESH
  ===================================================== */

  useEffect(() => {
    fetchStats();

    /*
      Refresh historical stats every
      30 seconds.
    */
    const interval =
      setInterval(
        fetchStats,
        30000
      );

    return () =>
      clearInterval(
        interval
      );
  }, []);

  /* =====================================================
     LAST 7 DAYS
  ===================================================== */

  /*
    The current database already exposes
    Today / Month / Total through
    get_visitor_stats().

    We don't invent 7-day historical
    values here. Until a dedicated
    historical RPC is added, this
    section uses the available
    statistics safely.
  */

  const last7Days =
    useMemo(() => {
      const days = [];

      for (
        let i = 6;
        i >= 0;
        i--
      ) {
        const date =
          new Date();

        date.setHours(
          0,
          0,
          0,
          0
        );

        date.setDate(
          date.getDate() - i
        );

        days.push({
          label:
            getDateLabel(
              date
            ),

          value:
            i === 0
              ? stats.today
              : 0,
        });
      }

      return days;
    }, [stats.today]);

  const chartMax =
    Math.max(
      ...last7Days.map(
        (item) =>
          item.value
      ),
      1
    );

  /* =====================================================
     UI
  ===================================================== */

  return (
    <main
      className={`analytics-page ${theme}`}
    >

      <div className="analytics-glow glow-a" />
      <div className="analytics-glow glow-b" />

      <div className="analytics-container">

        {/* HEADER */}

        <header className="analytics-header">

          <div className="analytics-brand">

            <div className="analytics-logo">
              H
            </div>

            <div>

              <h1>
                HoneyShare
              </h1>

              <p>
                Analytics Dashboard
              </p>

            </div>

          </div>

          <div className="header-actions">

            <a
              href="/"
              className="home-button"
            >
              ← Website
            </a>

            <button
              type="button"
              className="theme-button"
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

        {/* TITLE */}

        <section className="analytics-title">

          <div>

            <span className="analytics-badge">
              LIVE ANALYTICS
            </span>

            <h2>
              Visitor overview.
            </h2>

            <p>
              Monitor HoneyShare traffic
              and active users in real time.
            </p>

          </div>

          <div className="refresh-status">

            <span className="live-dot" />

            <span>
              Live connection
            </span>

          </div>

        </section>

        {/* ERROR */}

        {error && (
          <div className="analytics-error">
            {error}
          </div>
        )}

        {/* STATS */}

        <section className="stats-grid">

          {/* LIVE */}

          <article className="stat-card live-card">

            <div className="stat-top">

              <span className="stat-label">
                LIVE USERS
              </span>

              <span className="stat-icon live">
                ●
              </span>

            </div>

            <div className="stat-value">
              {liveUsers}
            </div>

            <div className="stat-description">
              Currently active
            </div>

          </article>

          {/* TODAY */}

          <article className="stat-card">

            <div className="stat-top">

              <span className="stat-label">
                TODAY
              </span>

              <span className="stat-icon">
                ◷
              </span>

            </div>

            <div className="stat-value">
              {loading
                ? "—"
                : stats.today}
            </div>

            <div className="stat-description">
              Unique visitors today
            </div>

          </article>

          {/* MONTH */}

          <article className="stat-card">

            <div className="stat-top">

              <span className="stat-label">
                THIS MONTH
              </span>

              <span className="stat-icon">
                ◫
              </span>

            </div>

            <div className="stat-value">
              {loading
                ? "—"
                : stats.month}
            </div>

            <div className="stat-description">
              Unique monthly visitors
            </div>

          </article>

          {/* TOTAL */}

          <article className="stat-card">

            <div className="stat-top">

              <span className="stat-label">
                ALL TIME
              </span>

              <span className="stat-icon">
                ◎
              </span>

            </div>

            <div className="stat-value">
              {loading
                ? "—"
                : stats.total}
            </div>

            <div className="stat-description">
              Total unique visitors
            </div>

          </article>

        </section>

        {/* LOWER GRID */}

        <section className="dashboard-grid">

          {/* CHART */}

          <article className="panel chart-panel">

            <div className="panel-header">

              <div>

                <span className="panel-label">
                  TRAFFIC
                </span>

                <h3>
                  Visitor activity
                </h3>

              </div>

              <span className="panel-period">
                LAST 7 DAYS
              </span>

            </div>

            <div className="chart">

              <div className="chart-y">

                <span>
                  {chartMax}
                </span>

                <span>
                  {Math.round(
                    chartMax *
                      0.66
                  )}
                </span>

                <span>
                  {Math.round(
                    chartMax *
                      0.33
                  )}
                </span>

                <span>
                  0
                </span>

              </div>

              <div className="chart-area">

                <div className="chart-grid-line line-1" />
                <div className="chart-grid-line line-2" />
                <div className="chart-grid-line line-3" />
                <div className="chart-grid-line line-4" />

                <div className="bars">

                  {last7Days.map(
                    (
                      item,
                      index
                    ) => {

                      const height =
                        item.value ===
                        0
                          ? 3
                          : Math.max(
                              8,
                              (item.value /
                                chartMax) *
                                100
                            );

                      return (
                        <div
                          className="bar-column"
                          key={`${item.label}-${index}`}
                        >

                          <div className="bar-value">
                            {item.value >
                            0
                              ? item.value
                              : ""}
                          </div>

                          <div
                            className="bar"
                            style={{
                              height: `${height}%`,
                            }}
                          />

                          <span className="bar-label">
                            {item.label}
                          </span>

                        </div>
                      );
                    }
                  )}

                </div>

              </div>

            </div>

            <div className="chart-note">
              Historical daily chart data will
              populate as daily visitor records
              accumulate.
            </div>

          </article>

          {/* SYSTEM */}

          <article className="panel system-panel">

            <div className="panel-header">

              <div>

                <span className="panel-label">
                  STATUS
                </span>

                <h3>
                  System overview
                </h3>

              </div>

            </div>

            <div className="system-list">

              <div className="system-row">

                <div className="system-name">

                  <span className="system-dot green" />

                  Realtime

                </div>

                <strong>
                  Connected
                </strong>

              </div>

              <div className="system-row">

                <div className="system-name">

                  <span className="system-dot green" />

                  Visitor tracking

                </div>

                <strong>
                  Active
                </strong>

              </div>

              <div className="system-row">

                <div className="system-name">

                  <span className="system-dot green" />

                  Database

                </div>

                <strong>
                  Connected
                </strong>

              </div>

              <div className="system-row">

                <div className="system-name">

                  <span className="system-dot green" />

                  Auto refresh

                </div>

                <strong>
                  30 sec
                </strong>

              </div>

            </div>

            <div className="updated-box">

              <span>
                LAST UPDATED
              </span>

              <strong>
                {lastUpdated
                  ? lastUpdated.toLocaleTimeString()
                  : "Loading..."}
              </strong>

            </div>

          </article>

        </section>

        {/* FOOTER */}

        <footer className="analytics-footer">

          <span>
            HoneyShare
          </span>

          <span>
            •
          </span>

          <a href="/">
            Temporary file sharing
          </a>

          <span>
            •
          </span>

          <span>
            Analytics
          </span>

        </footer>

      </div>

      {/* PAGE STYLES */}

      <style jsx>{`

        * {
          box-sizing: border-box;
        }

        .analytics-page {
          --bg: #090e1d;
          --text: #f8f9ff;
          --muted: #aab3c9;
          --muted2: #7f8aa4;
          --card: rgba(20, 28, 50, 0.94);
          --border: #2d3857;
          --soft: #121a30;
          --primary: #ffffff;
          --primaryText: #101526;

          min-height: 100svh;

          background: var(--bg);
          color: var(--text);

          font-family:
            var(--font-manrope),
            Arial,
            sans-serif;

          padding: 28px;

          position: relative;

          overflow-x: hidden;

          transition:
            background 0.3s ease,
            color 0.3s ease;
        }

        .analytics-page.light {
          --bg: #f3f5fa;
          --text: #111827;
          --muted: #5f6b83;
          --muted2: #77839a;
          --card: rgba(255, 255, 255, 0.96);
          --border: #d6deec;
          --soft: #eef2f8;
          --primary: #111827;
          --primaryText: #ffffff;
        }

        .analytics-glow {
          position: fixed;

          width: 420px;
          height: 420px;

          border-radius: 50%;

          filter: blur(120px);

          pointer-events: none;

          opacity: 0.18;

          z-index: 0;
        }

        .glow-a {
          background: #6253d9;

          top: -240px;
          left: -180px;
        }

        .glow-b {
          background: #00a98f;

          right: -180px;
          bottom: -250px;
        }

        .analytics-container {
          position: relative;

          z-index: 1;

          width: min(
            1180px,
            100%
          );

          margin: 0 auto;
        }

        /* HEADER */

        .analytics-header {
          display: flex;

          align-items: center;

          justify-content: space-between;

          margin-bottom: 48px;
        }

        .analytics-brand {
          display: flex;

          align-items: center;

          gap: 13px;
        }

        .analytics-logo {
          width: 50px;
          height: 50px;

          border-radius: 15px;

          display: grid;

          place-items: center;

          background: var(--primary);

          color: var(--primaryText);

          font-family:
            var(--font-space),
            sans-serif;

          font-size: 24px;

          font-weight: 700;
        }

        .analytics-brand h1 {
          margin: 0;

          font-family:
            var(--font-space),
            sans-serif;

          font-size: 23px;

          letter-spacing: -0.7px;
        }

        .analytics-brand p {
          margin: 4px 0 0;

          color: var(--muted);

          font-size: 12px;

          font-weight: 500;
        }

        .header-actions {
          display: flex;

          align-items: center;

          gap: 10px;
        }

        .home-button,
        .theme-button {
          height: 44px;

          border: 1px solid var(--border);

          background: var(--card);

          color: var(--text);

          border-radius: 13px;

          text-decoration: none;

          display: flex;

          align-items: center;

          justify-content: center;

          padding: 0 15px;

          font-size: 12px;

          font-weight: 700;
        }

        .theme-button {
          width: 44px;

          padding: 0;

          cursor: pointer;

          font-size: 17px;
        }

        /* TITLE */

        .analytics-title {
          display: flex;

          align-items: flex-end;

          justify-content: space-between;

          gap: 20px;

          margin-bottom: 28px;
        }

        .analytics-badge {
          display: inline-flex;

          border: 1px solid var(--border);

          border-radius: 999px;

          padding: 7px 12px;

          color: var(--muted);

          font-family:
            var(--font-space),
            sans-serif;

          font-size: 10px;

          font-weight: 700;

          letter-spacing: 1.5px;

          margin-bottom: 12px;
        }

        .analytics-title h2 {
          margin: 0 0 10px;

          font-family:
            var(--font-space),
            sans-serif;

          font-size: clamp(
            42px,
            5vw,
            62px
          );

          line-height: 0.98;

          letter-spacing: -3px;

          font-weight: 700;
        }

        .analytics-title p {
          margin: 0;

          color: var(--muted);

          font-size: 14px;

          font-weight: 500;
        }

        .refresh-status {
          display: flex;

          align-items: center;

          gap: 8px;

          color: var(--muted);

          font-size: 12px;

          font-weight: 600;

          padding-bottom: 7px;
        }

        .live-dot {
          width: 9px;
          height: 9px;

          border-radius: 50%;

          background: #00b58d;

          box-shadow:
            0 0 0 5px
            rgba(0, 181, 141, 0.1);

          animation:
            pulse 1.8s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }

          50% {
            opacity: 0.45;
          }
        }

        /* ERROR */

        .analytics-error {
          padding: 13px 16px;

          margin-bottom: 18px;

          border-radius: 12px;

          background:
            rgba(230, 80, 95, 0.08);

          border: 1px solid
            rgba(230, 80, 95, 0.2);

          color: #e66a73;

          font-size: 13px;

          font-weight: 600;
        }

        /* STATS */

        .stats-grid {
          display: grid;

          grid-template-columns:
            repeat(4, 1fr);

          gap: 15px;

          margin-bottom: 18px;
        }

        .stat-card {
          background: var(--card);

          border: 1px solid var(--border);

          border-radius: 21px;

          padding: 21px;

          min-height: 175px;

          box-shadow:
            0 15px 45px
            rgba(0, 0, 0, 0.08);
        }

        .stat-top {
          display: flex;

          align-items: center;

          justify-content: space-between;
        }

        .stat-label {
          color: var(--muted);

          font-family:
            var(--font-space),
            sans-serif;

          font-size: 10px;

          font-weight: 700;

          letter-spacing: 1.5px;
        }

        .stat-icon {
          width: 32px;
          height: 32px;

          border-radius: 10px;

          display: grid;

          place-items: center;

          background: var(--soft);

          color: var(--muted);

          font-size: 15px;
        }

        .stat-icon.live {
          color: #00b58d;

          background:
            rgba(0, 181, 141, 0.1);
        }

        .stat-value {
          margin-top: 21px;

          font-family:
            var(--font-space),
            sans-serif;

          font-size: 43px;

          line-height: 1;

          letter-spacing: -2px;

          font-weight: 700;
        }

        .stat-description {
          margin-top: 10px;

          color: var(--muted2);

          font-size: 12px;

          font-weight: 500;
        }

        /* LOWER GRID */

        .dashboard-grid {
          display: grid;

          grid-template-columns:
            minmax(0, 1.55fr)
            minmax(300px, 0.8fr);

          gap: 18px;
        }

        .panel {
          background: var(--card);

          border: 1px solid var(--border);

          border-radius: 22px;

          padding: 23px;

          min-height: 330px;
        }

        .panel-header {
          display: flex;

          align-items: flex-start;

          justify-content: space-between;

          margin-bottom: 25px;
        }

        .panel-label {
          display: block;

          color: var(--muted);

          font-family:
            var(--font-space),
            sans-serif;

          font-size: 10px;

          font-weight: 700;

          letter-spacing: 1.5px;

          margin-bottom: 6px;
        }

        .panel h3 {
          margin: 0;

          font-family:
            var(--font-space),
            sans-serif;

          font-size: 22px;

          letter-spacing: -0.7px;
        }

        .panel-period {
          color: var(--muted2);

          font-family:
            var(--font-space),
            sans-serif;

          font-size: 9px;

          font-weight: 700;

          letter-spacing: 1.2px;
        }

        /* CHART */

        .chart {
          display: flex;

          height: 185px;

          width: 100%;
        }

        .chart-y {
          width: 34px;

          display: flex;

          flex-direction: column;

          justify-content: space-between;

          padding-bottom: 24px;

          color: var(--muted2);

          font-size: 9px;

          font-weight: 600;

          text-align: right;
        }

        .chart-area {
          position: relative;

          flex: 1;

          margin-left: 12px;

          border-bottom:
            1px solid var(--border);
        }

        .chart-grid-line {
          position: absolute;

          left: 0;
          right: 0;

          border-top:
            1px dashed
            rgba(127, 138, 164, 0.15);
        }

        .line-1 {
          top: 0;
        }

        .line-2 {
          top: 33.33%;
        }

        .line-3 {
          top: 66.66%;
        }

        .line-4 {
          bottom: 0;
        }

        .bars {
          position: absolute;

          inset: 0;

          display: flex;

          align-items: flex-end;

          justify-content: space-around;

          gap: 10px;

          padding: 0 10px;
        }

        .bar-column {
          position: relative;

          height: 100%;

          flex: 1;

          display: flex;

          flex-direction: column;

          align-items: center;

          justify-content: flex-end;
        }

        .bar {
          width: min(
            42px,
            70%
          );

          min-height: 3px;

          border-radius:
            8px 8px 3px 3px;

          background:
            linear-gradient(
              180deg,
              #8b7cf6,
              #5f51c8
            );

          transition:
            height 0.4s ease;
        }

        .bar-value {
          position: absolute;

          bottom: calc(
            var(--bar-height, 0%)
          );

          color: var(--muted);

          font-size: 9px;

          font-weight: 700;
        }

        .bar-label {
          position: absolute;

          bottom: -23px;

          color: var(--muted2);

          font-size: 9px;

          font-weight: 600;

          white-space: nowrap;
        }

        .chart-note {
          margin-top: 35px;

          color: var(--muted2);

          font-size: 10px;

          line-height: 1.4;
        }

        /* SYSTEM */

        .system-list {
          display: flex;

          flex-direction: column;

          gap: 0;
        }

        .system-row {
          min-height: 51px;

          display: flex;

          align-items: center;

          justify-content: space-between;

          border-bottom:
            1px solid
            var(--border);
        }

        .system-name {
          display: flex;

          align-items: center;

          gap: 9px;

          color: var(--muted);

          font-size: 12px;

          font-weight: 600;
        }

        .system-dot {
          width: 7px;
          height: 7px;

          border-radius: 50%;
        }

        .system-dot.green {
          background: #00b58d;

          box-shadow:
            0 0 0 4px
            rgba(0, 181, 141, 0.08);
        }

        .system-row strong {
          color: var(--text);

          font-family:
            var(--font-space),
            sans-serif;

          font-size: 11px;

          font-weight: 700;
        }

        .updated-box {
          margin-top: 22px;

          padding: 13px;

          border-radius: 13px;

          background: var(--soft);

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 10px;
        }

        .updated-box span {
          color: var(--muted2);

          font-family:
            var(--font-space),
            sans-serif;

          font-size: 9px;

          font-weight: 700;

          letter-spacing: 1px;
        }

        .updated-box strong {
          color: var(--text);

          font-size: 11px;

          font-weight: 700;
        }

        /* FOOTER */

        .analytics-footer {
          display: flex;

          justify-content: center;

          align-items: center;

          flex-wrap: wrap;

          gap: 8px;

          margin-top: 22px;

          color: var(--muted2);

          font-size: 11px;

          font-weight: 500;
        }

        .analytics-footer span:first-child {
          color: var(--muted);

          font-family:
            var(--font-space),
            sans-serif;

          font-weight: 700;
        }

        .analytics-footer a {
          color: inherit;

          text-decoration: none;
        }

        /* MOBILE */

        @media (max-width: 900px) {

          .stats-grid {
            grid-template-columns:
              repeat(2, 1fr);
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {

          .analytics-page {
            padding: 18px 14px 24px;
          }

          .analytics-header {
            margin-bottom: 35px;
          }

          .analytics-title {
            align-items: flex-start;

            flex-direction: column;
          }

          .analytics-title h2 {
            font-size: 43px;

            letter-spacing: -2.4px;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;

            gap: 10px;
          }

          .stat-card {
            min-height: 145px;

            padding: 16px;

            border-radius: 17px;
          }

          .stat-value {
            font-size: 34px;
          }

          .stat-description {
            font-size: 10px;
          }

          .panel {
            padding: 18px;

            border-radius: 18px;
          }

          .home-button {
            display: none;
          }
        }

        @media (max-width: 390px) {

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .stat-card {
            min-height: 135px;
          }

          .analytics-title h2 {
            font-size: 38px;
          }
        }

      `}</style>

    </main>
  );
}
