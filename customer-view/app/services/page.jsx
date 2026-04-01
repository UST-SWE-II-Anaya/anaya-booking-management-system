"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

import anayaLogo from "../../public/Logo.png";

// ── Static fallback images for each known category ──────────────────────────
// (used when Supabase image_url is empty / offline)
const FALLBACK_IMAGES = {
  "nail care": "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80",
  "lash & brow care": "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80",
  "led lashes extension": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&q=80",
  "facial care": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80",
  "glutathione treatment": "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600&q=80",
  "foot care": "https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=600&q=80",
  "waxing treatment": "https://images.unsplash.com/photo-1519824145371-296894a4fb9a?w=600&q=80",
  "warts removal": "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&q=80",
  "underarm care": "https://images.unsplash.com/photo-1607748851687-ba9a10438621?w=600&q=80",
  "hand care": "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80",
  "slimming treatment": "https://images.unsplash.com/photo-1616803689943-5601631c7fec?w=600&q=80",
};

function getFallback(name) {
  const key = name?.toLowerCase() || "";
  for (const [k, v] of Object.entries(FALLBACK_IMAGES)) {
    if (key.includes(k)) return v;
  }
  return "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80";
}

// ── Skeleton card shown while loading ────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="service-card skeleton-card">
      <div className="skeleton-shimmer" />
    </div>
  );
}

export default function ServicesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from("service_categories")
        .select("*")
        .order("category_id", { ascending: true });

      if (!error && data) setCategories(data);
      setLoading(false);
    }
    fetchCategories();
  }, []);

  // Static demo categories shown when DB is empty / offline
  const demoCategories = [
    { category_id: 1, name: "Nail Care" },
    { category_id: 2, name: "Lash & Brow Care" },
    { category_id: 3, name: "LED Lashes Extension" },
    { category_id: 4, name: "Facial Care" },
    { category_id: 5, name: "Glutathione Treatment" },
    { category_id: 6, name: "Foot Care" },
    { category_id: 7, name: "Waxing Treatment" },
    { category_id: 8, name: "Warts Removal" },
    { category_id: 9, name: "Underarm Care" },
    { category_id: 10, name: "Hand Care" },
    { category_id: 11, name: "Slimming Treatment" },
  ];

  const displayCategories = categories.length > 0 ? categories : demoCategories;

  return (
    <>
      <style>{`
        /* ── Reset & Base ─────────────────────────────────────── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Geist', 'Inter', sans-serif; background: #F9F8F5; }

        /* ── Nav ─────────────────────────────────────────────── */
        .services-nav {
          position: sticky; top: 0; z-index: 50;
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 40px;
          background: #8A956D;
        }
        .nav-links { display: flex; align-items: center; gap: 32px; }
        .nav-links a {
          color: #fff; text-decoration: none; font-size: 13px; font-weight: 500;
          transition: opacity .2s;
        }
        .nav-links a:hover { opacity: .75; }
        .nav-signup {
          background: #fff; color: #8A956D !important;
          padding: 8px 22px; border-radius: 999px; font-weight: 700 !important;
          transition: background .2s !important;
        }
        .nav-signup:hover { background: #f0f0f0 !important; opacity: 1 !important; }
        .nav-logo { height: 32px; width: auto; object-fit: contain; cursor: pointer; }

        /* ── Hero Banner ─────────────────────────────────────── */
        .services-hero {
          background: #8A956D;
          display: flex; align-items: center; justify-content: center;
          padding: 56px 24px 48px;
        }
        .services-hero h1 {
          font-size: clamp(28px, 5vw, 42px);
          font-family: Georgia, 'Times New Roman', serif;
          color: #fff; letter-spacing: .08em; font-weight: 400;
        }

        /* ── Grid Section ────────────────────────────────────── */
        .services-grid-section {
          background: #F9F8F5;
          padding: 48px 40px 72px;
          max-width: 1100px; margin: 0 auto;
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        @media (max-width: 900px) {
          .services-grid { grid-template-columns: repeat(2, 1fr); }
          .services-nav { padding: 14px 20px; }
        }
        @media (max-width: 560px) {
          .services-grid { grid-template-columns: 1fr; }
        }

        /* ── Service Card ────────────────────────────────────── */
        .service-card {
          position: relative; height: 300px; border-radius: 4px;
          overflow: hidden; cursor: pointer;
          box-shadow: 0 4px 18px rgba(0,0,0,.12);
          transition: transform .35s ease, box-shadow .35s ease;
          text-decoration: none; display: block;
        }
        .service-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,.2);
        }
        .service-card img {
          position: absolute; inset: 0;
          width: 100%; height: 100%; object-fit: cover;
          transition: transform .5s ease;
        }
        .service-card:hover img { transform: scale(1.06); }

        /* dark overlay */
        .card-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,.58) 0%, rgba(0,0,0,.08) 55%);
          transition: background .3s;
        }
        .service-card:hover .card-overlay {
          background: linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.18) 55%);
        }

        /* text block */
        .card-text {
          position: absolute; bottom: 20px; left: 20px;
          color: #fff; z-index: 2;
        }
        .card-text p {
          font-family: Georgia, serif; font-size: 17px; margin-bottom: 4px;
          text-shadow: 0 1px 4px rgba(0,0,0,.5);
        }
        .card-text span {
          font-size: 11.5px; letter-spacing: .04em; font-weight: 500;
          border-bottom: 1px solid rgba(255,255,255,.5);
          padding-bottom: 1px;
          transition: border-color .2s;
        }
        .service-card:hover .card-text span { border-color: #fff; }

        /* ── Skeleton ────────────────────────────────────────── */
        .skeleton-card { background: #e8e4dc; }
        .skeleton-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent 30%, rgba(255,255,255,.35) 50%, transparent 70%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Footer ─────────────────────────────────────────── */
        .services-footer {
          background: #8A956D; color: #fff;
          padding: 40px 40px 32px; font-size: 12px;
        }
        .footer-inner {
          max-width: 1100px; margin: 0 auto;
          display: flex; flex-wrap: wrap; gap: 40px;
          align-items: flex-start; justify-content: space-between;
        }
        .footer-logo { height: 36px; filter: brightness(0) invert(1); }
        .footer-col { display: flex; flex-direction: column; gap: 8px; min-width: 140px; }
        .footer-col a, .footer-col p { color: #fff; text-decoration: none; line-height: 1.6; }
        .footer-col a:hover { text-decoration: underline; }
        .footer-col .footer-heading { font-weight: 700; margin-bottom: 2px; }
        .footer-contact p { line-height: 1.8; }
        .footer-hours { margin-top: 6px; font-style: italic; opacity: .85; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#F9F8F5" }}>

        {/* ── Nav ── */}
        <nav className="services-nav">
          <Link href="/">
            <Image src={anayaLogo} alt="Anaya Logo" className="nav-logo" priority />
          </Link>
          <div className="nav-links">
            <Link href="/services">Services</Link>
            <Link href="/about">About us</Link>
            <Link href="/location">Location</Link>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="nav-signup">Sign up</Link>
          </div>
        </nav>

        {/* ── Hero Banner ── */}
        <div className="services-hero">
          <h1>Our Services</h1>
        </div>

        {/* ── Services Grid ── */}
        <div style={{ background: "#F9F8F5", paddingBottom: 72 }}>
          <div className="services-grid-section">
            <div className="services-grid">
              {loading
                ? Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)
                : displayCategories.map((cat) => {
                    const imgSrc = cat.image_url?.startsWith("http")
                      ? cat.image_url
                      : getFallback(cat.name);

                    return (
                      <Link
                        key={cat.category_id}
                        href={`/services/${cat.category_id}`}
                        className="service-card"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imgSrc} alt={cat.name} loading="lazy" />
                        <div className="card-overlay" />
                        <div className="card-text">
                          <p>{cat.name}</p>
                          <span>Learn more &rsaquo;</span>
                        </div>
                      </Link>
                    );
                  })}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="services-footer">
          <div className="footer-inner">
            <Image src={anayaLogo} alt="Anaya Logo" className="footer-logo" />

            <div className="footer-col">
              <Link href="/services">Services</Link>
              <Link href="/about">About us</Link>
              <Link href="/location">Location</Link>
              <Link href="/signup">Book an appointment</Link>
            </div>

            <div className="footer-col footer-contact">
              <p className="footer-heading">Contacts &amp; Address</p>
              <p>The ONE Building, B/F, Cresent<br />Dr, Alabang, Philippines</p>
              <p>+63 945 297 7381</p>
              <p>anayaaesthetics@gmail.com</p>
              <p className="footer-hours">Hours<br />9am – 8pm</p>
            </div>

            <div className="footer-col">
              <p className="footer-heading">Follow Us</p>
              <p>Facebook</p>
              <p>Instagram</p>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
