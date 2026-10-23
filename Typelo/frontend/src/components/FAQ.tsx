/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * FAQ Component - Frequently Asked Questions page for SEO.
 * Contains FAQPage structured data for Google rich results eligibility.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * FAQ: Main component rendering the FAQ page with semantic HTML and JSON-LD.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * faqData: Array of question/answer pairs imported from data file.
 * faqSchema: JSON-LD FAQPage structured data object.
 * categories: Unique category list for organizing FAQ display.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react: React core for component creation.
 * react-router-dom: Link component for navigation.
 * framer-motion: Page entrance animations (matching app style).
 * data/faqData: Comprehensive FAQ dataset.
 * SEOHead: Dynamic meta tag management.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { faqData, faqSchema } from '../data/faqData'
import SEOHead from './SEOHead'

export default function FAQ() {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

    const categories = [...new Set(faqData.map(item => item.category))]
    const filteredFAQ = selectedCategory
        ? faqData.filter(item => item.category === selectedCategory)
        : faqData

    return (
        <>
            <SEOHead
                title="FAQ"
                description="Frequently asked questions about Typelo, the real-time 1v1 competitive typing game. Find answers about gameplay, ranking, friends, and more."
                path="/faq"
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="min-h-screen w-full bg-bg-primary text-text-primary px-6 sm:px-12 py-12"
            >
                <div className="max-w-4xl mx-auto">
                    <header className="mb-12">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-text-muted hover:text-white transition-colors mb-8"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            <span className="text-sm">Back to Typelo</span>
                        </Link>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                            Frequently Asked Questions
                        </h1>
                        <p className="text-text-secondary mb-6">
                            Find answers to common questions about Typelo, the competitive typing game.
                        </p>

                        {/* Category Filter */}
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${!selectedCategory
                                        ? 'bg-white text-black border-white'
                                        : 'border-white/20 text-text-muted hover:border-white/40'
                                    }`}
                            >
                                All ({faqData.length})
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${selectedCategory === cat
                                            ? 'bg-white text-black border-white'
                                            : 'border-white/20 text-text-muted hover:border-white/40'
                                        }`}
                                >
                                    {cat} ({faqData.filter(f => f.category === cat).length})
                                </button>
                            ))}
                        </div>
                    </header>

                    <main>
                        <dl className="space-y-6">
                            {filteredFAQ.map((item, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(index * 0.02, 0.5) }}
                                    className="border-b border-white/10 pb-6"
                                >
                                    <dt className="text-base font-semibold text-white mb-2 flex items-start gap-3">
                                        <span className="text-text-muted text-xs font-normal bg-white/5 px-2 py-0.5 rounded shrink-0">
                                            {item.category}
                                        </span>
                                        <span>{item.question}</span>
                                    </dt>
                                    <dd className="text-text-secondary text-sm leading-relaxed pl-0 sm:pl-20">
                                        {item.answer}
                                    </dd>
                                </motion.div>
                            ))}
                        </dl>
                    </main>

                    <footer className="mt-16 pt-8 border-t border-white/10">
                        <p className="text-text-muted text-sm text-center">
                            Typelo is a real-time 1v1 competitive typing game.
                        </p>
                        <div className="flex justify-center mt-4">
                            <Link
                                to="/"
                                className="text-sm text-white/60 hover:text-white transition-colors"
                            >
                                Start Playing
                            </Link>
                        </div>
                    </footer>
                </div>
            </motion.div>
        </>
    )
}
