"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

// Image imports
import anayaLogo from "../../public/Logo.png";
// Make sure to export this new image from Figma and put it in your public folder!
import signupFlower from "../../public/signup-flower.png";

export default function SignUpPage() {
    // Form State
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [dob, setDob] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // UI State
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [loading, setLoading] = useState(false);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const handleSignUp = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        // 1. Check if passwords match
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            setLoading(false);
            return;
        }

        // 2. Call Supabase Sign Up
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                // This attaches the extra ERD data to the user's auth profile
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    phone_number: phone,
                    date_of_birth: dob,
                },
            },
        });

        if (error) {
            setError(error.message);
        } else {
            setSuccess("Account created successfully! Check your email to verify.");
            // Optional: Redirect to login page after a few seconds
        }

        setLoading(false);
    };

    const handleGoogleSignIn = async () => {
        // We will wire this up later!
    };

    return (
        <div className="min-h-screen bg-[#3F3F3F] flex flex-col font-sans">

            {/* Navigation Bar */}
            <nav className="flex items-center justify-between px-10 py-4 bg-[#8A956D] text-white">
                <div className="flex items-center gap-2">
                    <Link href="/">
                        <Image
                            src={anayaLogo}
                            alt="Anaya Studio Logo"
                            className="h-8 w-auto object-contain"
                            priority
                        />
                    </Link>
                </div>
                <div className="flex items-center gap-6 text-sm font-medium">
                    <Link href="/services">Services</Link>
                    <Link href="/about">About us</Link>
                    <Link href="/location">Location</Link>
                    <Link href="/login">Log in</Link>
                    <Link href="/signup" className="font-bold">Sign up</Link>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-8">
                <div className="flex w-full max-w-5xl min-h-[700px] shadow-2xl overflow-hidden rounded-sm">

                    {/* Left Side - Botanical Image */}
                    <div className="w-1/2 bg-[#8A956D] relative hidden md:block">
                        <Image
                            src={signupFlower}
                            alt="Anaya Botanical Aesthetic"
                            fill
                            className="object-cover p-8"
                            priority
                        />
                    </div>

                    {/* Right Side - Sign Up Form */}
                    <div className="w-full md:w-1/2 bg-[#F9F8F5] px-12 py-10 flex flex-col items-center justify-center">

                        <h2 className="text-3xl text-gray-800 mb-8 font-serif tracking-wide">Create your Account</h2>

                        <form onSubmit={handleSignUp} className="w-full max-w-sm flex flex-col gap-4">

                            {/* Email Input */}
                            <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1" htmlFor="email">Email*</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-transparent border-b border-black py-1 focus:outline-none focus:border-gray-500 text-sm"
                                    required
                                />
                            </div>

                            {/* Phone Input */}
                            <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1" htmlFor="phone">Phone number (optional)</label>
                                <input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="bg-transparent border-b border-black py-1 focus:outline-none focus:border-gray-500 text-sm"
                                />
                            </div>

                            {/* First Name Input */}
                            <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1" htmlFor="firstName">First Name*</label>
                                <input
                                    id="firstName"
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="bg-transparent border-b border-black py-1 focus:outline-none focus:border-gray-500 text-sm"
                                    required
                                />
                            </div>

                            {/* Last Name Input */}
                            <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1" htmlFor="lastName">Last Name*</label>
                                <input
                                    id="lastName"
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="bg-transparent border-b border-black py-1 focus:outline-none focus:border-gray-500 text-sm"
                                    required
                                />
                            </div>

                            {/* Date of Birth Input */}
                            <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1" htmlFor="dob">Date of Birth*</label>
                                <input
                                    id="dob"
                                    type="date"
                                    value={dob}
                                    onChange={(e) => setDob(e.target.value)}
                                    className="bg-transparent border-b border-black py-1 focus:outline-none focus:border-gray-500 text-sm text-gray-700"
                                    required
                                />
                            </div>

                            {/* Password Input */}
                            <div className="flex flex-col">
                                <label className="text-xs text-gray-500 mb-1" htmlFor="password">Password*</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-transparent border-b border-black py-1 focus:outline-none focus:border-gray-500 text-sm"
                                    required
                                />
                            </div>

                            {/* Confirm Password Input */}
                            <div className="flex flex-col mb-4">
                                <label className="text-xs text-gray-500 mb-1" htmlFor="confirmPassword">Confirm Password*</label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="bg-transparent border-b border-black py-1 focus:outline-none focus:border-gray-500 text-sm"
                                    required
                                />
                            </div>

                            {/* Static hCaptcha Placeholder (Visual Only for now) */}
                            <div className="flex justify-center mb-2">
                                <div className="border border-gray-300 rounded px-4 py-2 flex items-center gap-4 bg-white shadow-sm w-[250px]">
                                    <input type="checkbox" className="w-4 h-4" />
                                    <span className="text-sm text-gray-600 flex-1">I am human</span>
                                    <div className="flex flex-col items-center">
                                        {/* Placeholder for hCaptcha logo */}
                                        <span className="text-[8px] text-gray-400">hCaptcha</span>
                                        <span className="text-[6px] text-gray-400">Privacy - Terms</span>
                                    </div>
                                </div>
                            </div>

                            {error && <p className="text-red-500 text-xs text-center">{error}</p>}
                            {success && <p className="text-green-600 text-xs text-center">{success}</p>}

                            {/* Sign Up Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-40 mx-auto bg-[#96A0B5] hover:bg-[#7D889F] text-white py-2 rounded-full text-sm transition-colors mt-2"
                            >
                                {loading ? "Creating..." : "Create an Account"}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="flex items-center w-full max-w-sm my-6">
                            <div className="flex-1 border-t border-gray-300"></div>
                            <span className="px-4 text-xs text-gray-400">or</span>
                            <div className="flex-1 border-t border-gray-300"></div>
                        </div>

                        {/* Google Sign In */}
                        <button
                            onClick={handleGoogleSignIn}
                            className="flex items-center gap-2 text-xs text-gray-600 hover:text-black transition-colors mb-2"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Sign in with Google
                        </button>

                    </div>
                </div>
            </main>
        </div>
    );
}