/*   ______      __ ____  _______       _  ____  _   _ 
 *  |  ____|   / / __ \|__   __|/\   | |/ __ \| \ | |
 *  | |__   _ / / |  | |  | |  /  \  | | |  | |  \| |
 *  |  __| | v /| |  | |  | | / /\ \ | | |  | | . ` |
 *  | |____ \ / | |__| |  | |/ ____ \| | |__| | |\  |
 *  |______| \_/ \____/   |_/_/    \_\_|\____/|_| \_|
 *                                                      
 */

/**
 * ComparisonPage Component - SEO comparison pages for brand visibility.
 * Reusable component for Typelo vs competitor comparisons.
 * 
 * --------------------------------------------------------------------------
 *                                  Functions
 * --------------------------------------------------------------------------
 * ComparisonPage: Main component rendering comparison content.
 * 
 * --------------------------------------------------------------------------
 *                            Variables and others
 * --------------------------------------------------------------------------
 * ComparisonData: Type for comparison page content.
 * 
 * --------------------------------------------------------------------------
 *                                   imports
 * --------------------------------------------------------------------------
 * react-router-dom: Link for internal navigation.
 * framer-motion: Consistent page animations.
 * SEOHead: Dynamic meta tag management.
 */

import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import SEOHead from './SEOHead'

interface FAQItem {
    question: string
    answer: string
}

interface FeatureRow {
    feature: string
    typelo: string
    competitor: string
}

interface ComparisonData {
    competitorName: string
    competitorFullName: string
    slug: string
    metaDescription: string
    intro: string
    competitorIntro: string
    features: FeatureRow[]
    competitiveFocus: {
        typelo: string
        competitor: string
    }
    ranking: {
        typelo: string
        competitor: string
    }
    useCases: {
        competitive: string
        casual: string
        learning: string
        pvp: string
    }
    summary: {
        typelo: string
        competitor: string
    }
    faq: FAQItem[]
}

interface ComparisonPageProps {
    data: ComparisonData
}

export default function ComparisonPage({ data }: ComparisonPageProps) {
    const pageSchema = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": `Typelo vs ${data.competitorName} – Competitive Typing Comparison`,
        "description": data.metaDescription,
        "url": `https://www.typelo.tech/compare/typelo-vs-${data.slug}`
    }

    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": data.faq.map(item => ({
            "@type": "Question",
            "name": item.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
            }
        }))
    }

    return (
        <>
            <SEOHead
                title={`Typelo vs ${data.competitorName} – Competitive Typing Comparison`}
                description={data.metaDescription}
                path={`/compare/typelo-vs-${data.slug}`}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }}
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
                <article className="max-w-4xl mx-auto">
                    {/* Navigation */}
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
                            Typelo vs {data.competitorName}
                        </h1>
                        <p className="text-text-secondary text-lg">
                            A factual comparison of competitive typing platforms.
                        </p>
                    </header>

                    {/* Introduction */}
                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4">Overview</h2>
                        <p className="text-text-secondary leading-relaxed mb-4">
                            {data.intro}
                        </p>
                        <p className="text-text-secondary leading-relaxed">
                            {data.competitorIntro}
                        </p>
                    </section>

                    {/* Feature Comparison Table */}
                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4">Feature Comparison</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="py-3 pr-4 text-text-muted text-sm font-medium">Feature</th>
                                        <th className="py-3 px-4 text-text-muted text-sm font-medium">Typelo</th>
                                        <th className="py-3 pl-4 text-text-muted text-sm font-medium">{data.competitorName}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.features.map((row, index) => (
                                        <tr key={index} className="border-b border-white/5">
                                            <td className="py-3 pr-4 text-white text-sm">{row.feature}</td>
                                            <td className="py-3 px-4 text-text-secondary text-sm">{row.typelo}</td>
                                            <td className="py-3 pl-4 text-text-secondary text-sm">{row.competitor}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Competitive Focus */}
                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4">Competitive Focus</h2>
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-white font-medium mb-2">Typelo</h3>
                                <p className="text-text-secondary text-sm leading-relaxed">
                                    {data.competitiveFocus.typelo}
                                </p>
                            </div>
                            <div>
                                <h3 className="text-white font-medium mb-2">{data.competitorName}</h3>
                                <p className="text-text-secondary text-sm leading-relaxed">
                                    {data.competitiveFocus.competitor}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Ranking & Scoring */}
                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4">Ranking and Scoring Systems</h2>
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-white font-medium mb-2">Typelo Ranking</h3>
                                <p className="text-text-secondary text-sm leading-relaxed">
                                    {data.ranking.typelo}
                                </p>
                            </div>
                            <div>
                                <h3 className="text-white font-medium mb-2">{data.competitorName} Scoring</h3>
                                <p className="text-text-secondary text-sm leading-relaxed">
                                    {data.ranking.competitor}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Use Cases */}
                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4">Best Use Cases</h2>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-white font-medium mb-2">For Competitive Players</h3>
                                <p className="text-text-secondary text-sm leading-relaxed">{data.useCases.competitive}</p>
                            </div>
                            <div>
                                <h3 className="text-white font-medium mb-2">For Casual Practice</h3>
                                <p className="text-text-secondary text-sm leading-relaxed">{data.useCases.casual}</p>
                            </div>
                            <div>
                                <h3 className="text-white font-medium mb-2">For Learning to Type</h3>
                                <p className="text-text-secondary text-sm leading-relaxed">{data.useCases.learning}</p>
                            </div>
                            <div>
                                <h3 className="text-white font-medium mb-2">For Real-time PvP</h3>
                                <p className="text-text-secondary text-sm leading-relaxed">{data.useCases.pvp}</p>
                            </div>
                        </div>
                    </section>

                    {/* Summary */}
                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4">Summary</h2>
                        <div className="space-y-4">
                            <p className="text-text-secondary text-sm leading-relaxed">
                                <strong className="text-white">Typelo</strong> {data.summary.typelo}
                            </p>
                            <p className="text-text-secondary text-sm leading-relaxed">
                                <strong className="text-white">{data.competitorName}</strong> {data.summary.competitor}
                            </p>
                        </div>
                    </section>

                    {/* FAQ Section */}
                    <section className="mb-12">
                        <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
                        <dl className="space-y-6">
                            {data.faq.map((item, index) => (
                                <div key={index} className="border-b border-white/10 pb-4">
                                    <dt className="text-white font-medium mb-2">{item.question}</dt>
                                    <dd className="text-text-secondary text-sm leading-relaxed">{item.answer}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>

                    {/* Internal Links */}
                    <footer className="pt-8 border-t border-white/10">
                        <nav className="flex flex-wrap gap-4">
                            <Link to="/" className="text-sm text-white/60 hover:text-white transition-colors">
                                Play Typelo
                            </Link>
                            <Link to="/faq" className="text-sm text-white/60 hover:text-white transition-colors">
                                FAQ
                            </Link>
                            <Link
                                to={data.slug === 'monkeytype' ? '/compare/typelo-vs-typeracer' : '/compare/typelo-vs-monkeytype'}
                                className="text-sm text-white/60 hover:text-white transition-colors"
                            >
                                {data.slug === 'monkeytype' ? 'Typelo vs TypeRacer' : 'Typelo vs Monkeytype'}
                            </Link>
                        </nav>
                        <p className="text-text-muted text-xs mt-6">
                            Typelo is a real-time 1v1 competitive typing game.
                        </p>
                    </footer>
                </article>
            </motion.div>
        </>
    )
}
