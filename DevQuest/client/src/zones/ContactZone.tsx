import { useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { useToast } from "@/hooks/use-toast";

// Reusable Contact Link Component
const ContactLink = ({ href, title, icon }: { href: string, title: string, icon: React.ReactNode }) => (
  <motion.a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="medieval-card flex flex-col items-center justify-center p-4 h-32 text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
    whileHover={{ scale: 1.05 }}
  >
    <div className="text-3xl mb-2 text-primary">{icon}</div>
    <span className="font-heading text-sm uppercase text-primary tracking-wider">{title}</span>
  </motion.a>
);

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const ContactZone = () => {
  const { setCurrentZone } = useGameStore();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate sending data (replace with actual API call)
    console.log("Sending form data:", formData);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    
    setIsSubmitting(false);
    toast({
      title: "Message Received!", // Themed title
      description: "Your raven has been dispatched. I shall reply ere long!", // Themed description
    });
    setFormData({ name: "", email: "", message: "" }); // Reset form
  };

  const handleResumeDownload = () => {
    // Correct path assuming resume is in public/assets
    const resumePath = '/assets/christopher_joshy_resume.pdf';
    const link = document.createElement('a');
    link.href = resumePath;
    link.download = 'Christopher_Joshy_Resume.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Scroll Downloaded!",
      description: "The resume scroll is now in your possession.",
    });
  };

  return (
    <motion.div 
      id="contact" 
      className="zone min-h-screen p-4 lg:p-8 relative bg-background"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      {/* Background elements - Texture URL removed */}
      {/* <div className="absolute inset-0 bg-[url('/textures/map-background.png')] opacity-5 mix-blend-multiply z-0"></div> */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background z-0"></div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.h1 variants={itemVariants} className="medieval-title text-center mb-4">Contact the Scribe</motion.h1>
        <motion.p variants={itemVariants} className="medieval-text text-center mb-12 text-foreground/80 max-w-2xl mx-auto">
          Send a raven, consult the guild records, or request an audience. Reach out through the channels below.
        </motion.p>
        
        {/* Contact Links Grid */}
        <motion.div 
          variants={containerVariants}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 mb-16"
        >
          <ContactLink href="https://github.com/ChristopherJoshy" title="GitHub" icon={<span>⚒️</span>} />
          <ContactLink href="https://www.linkedin.com/in/christopher-joshy-272a77290/" title="LinkedIn" icon={<span>📜</span>} />
          <ContactLink href="mailto:christopherjoshy4@gmail.com" title="Email" icon={<span>✉️</span>} />
          <ContactLink href="https://instagram.com/calculatederror" title="Instagram" icon={<span>🏰</span>} />
          {/* Resume Download as a link card */}
          <motion.div variants={itemVariants}>
            <button 
              onClick={handleResumeDownload}
              className="medieval-card flex flex-col items-center justify-center p-4 h-32 text-center w-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="text-3xl mb-2 text-primary">📄</div>
              <span className="font-heading text-sm uppercase text-primary tracking-wider">Resume</span>
            </button>
           </motion.div>
        </motion.div>

        {/* Contact Form */}
        <motion.div variants={itemVariants} className="medieval-card max-w-xl mx-auto p-6 md:p-8">
          <h2 className="font-heading text-xl text-primary mb-6 text-center uppercase border-b border-border/50 pb-3">Send a Message by Raven Post</h2>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="contact-name" className="block font-heading text-sm text-secondary mb-1">Your Name</label>
              <input 
                id="contact-name"
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="medieval-input" 
                placeholder="e.g., Lord Reginald"
                required
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="block font-heading text-sm text-secondary mb-1">Your Email Address</label>
              <input 
                id="contact-email"
                type="email" 
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="medieval-input" 
                placeholder="e.g., squire@castlename.realm"
                required
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="block font-heading text-sm text-secondary mb-1">Your Missive</label>
              <textarea 
                id="contact-message"
                name="message"
                value={formData.message}
                onChange={handleInputChange}
                className="medieval-input h-32 resize-none" 
                placeholder="Inscribe your message here..."
                required
              ></textarea>
            </div>
            <div className="text-center pt-2">
              <button 
                type="submit" 
                className="medieval-button px-8 py-3 text-lg w-full sm:w-auto disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending Raven..." : "Dispatch Raven"}
              </button>
            </div>
          </form>
        </motion.div>
        
        {/* Return Home Button */}
        <motion.div variants={itemVariants} className="flex justify-center mt-16">
          <button 
            className="medieval-button-secondary px-6 py-2"
            onClick={() => setCurrentZone('home')}
          >
            Return to Home Spire
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default ContactZone;
