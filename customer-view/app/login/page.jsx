"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import botanicalArt from "../../public/botanical-art.png";
import anayaLogo from "../../public/Logo.png";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Initialize the Supabase client for the browser
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const handleSignIn = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
        } else {
            // Redirect the user upon successful login
            window.location.href = "/"; // Change this to your desired redirect path
        }

        setLoading(false);
    };

    const handleGoogleSignIn = async () => {
        // We will set this up when you're ready for OAuth!
    };

    return (
        <div className="min-h-screen bg-[#3F3F3F] flex flex-col font-sans">

            {/* Navigation Bar */}
            <nav className="flex items-center justify-between px-10 py-4 bg-[#8A956D] text-white">
                <div className="flex items-center gap-2">
                    {/* Replaced text with the Next.js Image component */}
                    <Link href="/">
                        <Image
                            src={anayaLogo}
                            alt="Anaya Studio Logo"
                            className="h-8 w-auto object-contain" /* h-8 keeps it perfectly sized for the navbar */
                            priority
                        />
                    </Link>
                </div>
                <div className="flex items-center gap-6 text-sm font-medium">
                    <Link href="/services">Services</Link>
                    <Link href="/about">About us</Link>
                    <Link href="/location">Location</Link>
                    <Link href="/login" className="font-bold">Log in</Link>
                    <Link href="/signup">Sign up</Link>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-8">
                {/* FIX 1: Changed h-[600px] to min-h-[600px] and added overflow-hidden */}
                <div className="flex w-full max-w-5xl min-h-[600px] shadow-2xl overflow-hidden rounded-sm">

                    {/* Left Side - Botanical Image */}
                    <div className="w-1/2 bg-[#8A956D] relative hidden md:block">
                        <Image
                            src={botanicalArt}
                            alt="Anaya Botanical Aesthetic"
                            fill
                            className="object-cover p-8"
                            priority
                        />
                    </div>

                    {/* Right Side - Login Form */}
                    {/* FIX 2: Added py-16 and px-12 to ensure it never touches the edges */}
                    <div className="w-full md:w-1/2 bg-[#F9F8F5] px-12 py-16 flex flex-col items-center justify-center">

                        {/* Logo area */}
                        <div className="text-center mb-8 mt-4">
                            <h1 className="text-4xl font-serif tracking-widest text-[#4A4A4A]">ANAYA</h1>
                            <p className="text-xs text-gray-500 mt-1 tracking-widest">AESTHETIC STUDIO</p>
                        </div>

                        <h2 className="text-lg text-gray-700 mb-8">Welcome to ANAYA</h2>

                        <form onSubmit={handleSignIn} className="w-full max-w-sm flex flex-col">

                            {/* Email Input */}
                            <div className="mb-6 flex flex-col">
                                <label className="text-xs text-gray-500 mb-1" htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-transparent border-b border-black py-1 focus:outline-none focus:border-gray-500 text-sm"
                                    required
                                />
                            </div>

                            {/* Password Input */}
                            <div className="mb-2 flex flex-col relative">
                                <label className="text-xs text-gray-500 mb-1" htmlFor="password">Password</label>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-transparent border-b border-black py-1 pr-8 focus:outline-none focus:border-gray-500 text-sm"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-0 bottom-1 text-gray-600 focus:outline-none"
                                >
                                    {showPassword ? "Hide" : "👁️"}
                                </button>
                            </div>

                            <div className="flex justify-end mb-8 w-full">
                                <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-black">
                                    Forget password?
                                </Link>
                            </div>

                            {error && <p className="text-red-500 text-xs mb-4 text-center">{error}</p>}

                            {/* Sign In Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-32 mx-auto bg-[#96A0B5] hover:bg-[#7D889F] text-white py-2 rounded-full text-sm transition-colors"
                            >
                                {loading ? "Signing In..." : "Sign In"}
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
                            className="flex items-center gap-2 text-xs text-gray-600 hover:text-black transition-colors mb-8"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Sign in with Google
                        </button>

                        {/* Sign Up Link */}
                        <p className="text-xs text-gray-500 mb-4">
                            New to ANAYA?{" "}
                            <Link href="/signup" className="text-black underline">
                                Create an Account
                            </Link>
                        </p>

                    </div>
                </div>
            </main>
        </div>
    );
}