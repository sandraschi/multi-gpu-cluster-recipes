import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import styles from "./index.module.css";

const sections = [
  {
    title: "Hardware Blueprint",
    href: "/docs/hardware-blueprint",
    text: "Power budgets, PSU sizing, undervolting presets, open-frame layout, and the full connectivity guide: internal risers, OCuLink, MCIO 8i (GPD G2) docks.",
  },
  {
    title: "Worker Orchestration",
    href: "/docs/worker-orchestration",
    text: "Primary / resident / worker GPU pools, CUDA device pinning, keepalive daemons, worker queues, VRAM budgets, and the host matrix.",
  },
  {
    title: "Monitoring and Ops",
    href: "/docs/monitoring-and-ops",
    text: "Per-pool metrics, thresholds that page you, runbooks for link drops, OOMs and isolation breaches, and honest power accounting.",
  },
  {
    title: "Scale-Up: HPC Ladder",
    href: "/docs/scale-up-hpc",
    text: "Multi-dock builds on PCIe 5 switch cards, multi-host fleets with notebook hosts, cost curves, and when to stop scaling.",
  },
];

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <header className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>{siteConfig.title}</h1>
          <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
          <div className={styles.heroButtons}>
            <Link className={styles.primaryButton} to="/docs/hardware-blueprint">
              Start with the hardware blueprint
            </Link>
            <Link
              className={styles.secondaryButton}
              href="https://github.com/sandraschi/multi-gpu-cluster-recipes"
            >
              GitHub repo
            </Link>
          </div>
        </div>
      </header>
      <main className="container" style={{ paddingTop: "3rem", paddingBottom: "3rem" }}>
        <div className="row">
          {sections.map((s) => (
            <div className="col col--6" key={s.title} style={{ marginBottom: "1.5rem" }}>
              <div className={styles.card}>
                <h2>
                  <Link to={s.href}>{s.title}</Link>
                </h2>
                <p>{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </main>
    </Layout>
  );
}
