"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

// Static Asset Imports (Backup if DB is empty or offline)
import anayaLogo from "../public/Logo.png";
import heroImage from "../public/Hero.png";
import facialCareImg from "../public/facial-care.png";
import handCareImg from "../public/hand-care.png";
import nailCareImg from "../public/nail-care.png";

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [inquiryData, setInquiryData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // 1. Fetch Categories from Supabase
  useEffect(() => {
    async function fetchCategories() {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .order('category_id', { ascending: true });

      if (!error && data) {
        setCategories(data);
      }
    }
    fetchCategories();
  }, [supabase]);

  // 2. Handle Contact Inquiry
  const handleInquiry = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase
      .from('inquiries')
      .insert([{
        name: inquiryData.name,
        email: inquiryData.email,
        message: inquiryData.message
      }]);

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Thank you! Your inquiry has been sent.");
      setInquiryData({ name: "", email: "", message: "" });
    }
    setIsSubmitting(false);
  };

  // Helper to map DB names to local files if image_url fails
  const getLocalBackupImage = (name) => {
    const searchName = name?.toLowerCase() || "";
    if (searchName.includes("facial")) return facialCareImg;
    if (searchName.includes("hand")) return handCareImg;
    if (searchName.includes("nail")) return nailCareImg;
    return facialCareImg;
  };

  return (
    <div className="min-h-screen font-sans bg-[#F9F8F5]">

      {/* --- 1. Navigation Bar --- */}
      <nav className="flex items-center justify-between px-10 py-4 bg-[#8A956D] text-white sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Link href="/">
            <Image src={anayaLogo} alt="Anaya Logo" className="h-8 w-auto object-contain" priority />
          </Link>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link href="/services" className="hover:text-gray-200">Services</Link>
          <Link href="/about" className="hover:text-gray-200">About us</Link>
          <Link href="/location" className="hover:text-gray-200">Location</Link>
          <Link href="/login" className="hover:text-gray-200">Log in</Link>
          <Link href="/signup" className="bg-white text-[#8A956D] px-5 py-2 rounded-full font-bold hover:bg-gray-100">
            Sign up
          </Link>
        </div>
      </nav>

      {/* --- 2. Hero Section --- */}
      <header className="relative h-[650px] flex items-center justify-center text-white overflow-hidden">
        <Image src={heroImage} alt="Hero" fill className="object-cover" priority />
        <div className="absolute inset-0 bg-black/30 z-10" />
        <div className="relative z-20 text-center flex flex-col items-center px-4">
          <h1 className="text-4xl md:text-6xl font-serif tracking-[0.15em] mb-6 drop-shadow-lg text-white">Your Everyday Reset</h1>
          <p className="text-sm md:text-lg tracking-[0.2em] mb-10 font-light max-w-2xl text-white">Advanced aesthetic techniques and personalized care for your best self.</p>
          <Link href="/signup" className="bg-[#CE845D] hover:bg-[#AE6F4D] text-white px-10 py-3 rounded-full text-sm font-bold tracking-widest transition-all hover:scale-105 shadow-lg">View Services & Book</Link>
        </div>
      </header>

      {/* --- 3. Features --- */}
      <section className="bg-[#F9F8F5] py-20 px-8 lg:px-20 border-b border-gray-200">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Certified <br /> Professionals</h3>
            <p className="text-sm text-gray-600">Our team of licensed aestheticians and medical staff follows the highest standards for safety and results. Your care is our priority.</p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Tailored <br />Treatment Plans</h3>
            <p className="text-sm text-gray-600">We believe beauty is personal. Each service starts with a private consultation to create a plan that fits your unique goals.</p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Serene Studio <br /> Environment</h3>
            <p className="text-sm text-gray-600">Step into a modern, calming space designed for your comfort and privacy. Your aesthetic journey should be a relaxing escape.</p>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-bold text-lg text-[#1A1A1A]">Simple Online <br /> Scheduling</h3>
            <p className="text-sm text-gray-600">Book, reschedule, or manage your appointments anytime, anywhere. Your journey to radiance is just a few clicks away.</p>
          </div>
        </div>
      </section>

      {/* --- 4/5. Popular Services (Dynamic via Supabase) --- */}
      <section className="py-20 bg-[#F9F8F5]">
        <div className="max-w-6xl mx-auto px-8 text-center">
          <h2 className="text-3xl font-serif text-[#4A4A4A] mb-16 tracking-wide">Our most popular services</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {categories.length > 0 ? categories.map((cat) => (
              <div key={cat.category_id} className="relative group h-80 rounded-sm overflow-hidden shadow-md">
                <Image
                  // Priority: Supabase URL -> Local Import
                  src={cat.image_url?.startsWith('http') ? cat.image_url : getLocalBackupImage(cat.name)}
                  alt={cat.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  unoptimized // Bypasses whitelist issues during local testing
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                <div className="absolute bottom-6 left-6 text-left text-white z-10">
                  <p className="font-serif text-xl mb-1">{cat.name}</p>
                  <Link href="/services" className="text-xs hover:underline">Learn more →</Link>
                </div>
              </div>
            )) : (
              <div className="col-span-3 py-10 text-gray-400 italic">Syncing with Anaya Studio database...</div>
            )}
          </div>
        </div>
      </section>

      {/* --- 6. Visit Us & Contact --- */}
      <section className="bg-[#8A956D] py-16 px-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12">
          <div className="w-full lg:w-2/3 h-[450px] bg-blue-50 rounded-3xl overflow-hidden shadow-xl border-4 border-white/20 flex items-center justify-center text-blue-400 font-bold">
            [GOOGLE MAPS INTERFACE]
          </div>
          <div className="w-full lg:w-1/3 bg-[#C4845D] p-8 text-white shadow-2xl rounded-[50px_20px_60px_30px]">
            <h3 className="text-xl font-bold mb-6">Contact and Find Us Here</h3>
            <form onSubmit={handleInquiry} className="flex flex-col gap-3">
              <input type="text" placeholder="Name" required value={inquiryData.name} onChange={(e) => setInquiryData({ ...inquiryData, name: e.target.value })} className="bg-white/10 border border-white/20 rounded-lg p-2 text-sm focus:outline-none" />
              <input type="email" placeholder="Email" required value={inquiryData.email} onChange={(e) => setInquiryData({ ...inquiryData, email: e.target.value })} className="bg-white/10 border border-white/20 rounded-lg p-2 text-sm focus:outline-none" />
              <textarea placeholder="Message" required rows="3" value={inquiryData.message} onChange={(e) => setInquiryData({ ...inquiryData, message: e.target.value })} className="bg-white/10 border border-white/20 rounded-lg p-2 text-sm focus:outline-none" />
              <button type="submit" disabled={isSubmitting} className="bg-white text-[#C4845D] py-2 rounded-full font-bold text-xs hover:bg-gray-100 uppercase tracking-tighter">
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
            <div className="mt-6 space-y-2 text-[11px] opacity-90 border-t border-white/20 pt-4">
              <p>📍 The ONE Building, Manila</p>
              <p>📞 +63 945 977 8183</p>
              <p>🕒 9:00 AM - 8:00 PM</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- 7. Footer --- */}
      <footer className="bg-[#8A956D] py-12 px-10 text-white border-t border-white/10 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
          <Image src={anayaLogo} alt="Logo" className="h-10 w-auto brightness-0 invert" />
          <div className="flex gap-12">
            <div className="flex flex-col gap-2">
              <Link href="/services">Services</Link>
              <Link href="/about">About us</Link>
              <Link href="/location">Location</Link>
            </div>
            <div className="space-y-1">
              <p className="font-bold">Follow Us</p>
              <p>Facebook</p>
              <p>Instagram</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}