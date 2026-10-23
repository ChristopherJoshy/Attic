import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";

// Sample Testimonial Data (Replace with real data)
const testimonials = [
  {
    id: 1,
    name: "Lord Reginald",
    role: "Master Blacksmith",
    quote: "Christopher's web-forging skills are second to none! He crafted a system for my shop that runs smoother than polished steel.",
    avatar: "/avatars/blacksmith.png" // Placeholder path
  },
  {
    id: 2,
    name: "Elara Meadowlight",
    role: "Guild Alchemist",
    quote: "His understanding of arcane AI arts transformed our guild's knowledge base. Truly magical work!",
    avatar: "/avatars/alchemist.png" // Placeholder path
  },
  {
    id: 3,
    name: "Sir Kaelen",
    role: "Knight Commander",
    quote: "The training simulation he built is incredibly intuitive and robust. Our squires have never been better prepared!",
    avatar: "/avatars/knight.png" // Placeholder path
  }
];

// Animation variants (similar to other zones)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

const TestimonialsZone = () => {
  const { setCurrentZone } = useGameStore();

  return (
    <motion.div
      id="testimonials"
      className="zone min-h-screen p-4 lg:p-8 relative bg-background"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      {/* Background elements - Texture URL removed */}
      {/* <div className="absolute inset-0 bg-[url('/textures/castle-hall.png')] opacity-10 mix-blend-overlay z-0"></div> */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background z-0"></div>

      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.h1 variants={itemVariants} className="medieval-title text-center mb-4">Hear Ye, Hear Ye! <br className="sm:hidden"/> Kind Words from the Realm</motion.h1>
        <motion.p variants={itemVariants} className="medieval-text text-center mb-12 text-foreground/80 max-w-2xl mx-auto">
          Testimonials from esteemed colleagues and collaborators met along the quest.
        </motion.p>

        {/* Testimonials Grid */}
        <motion.div 
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-16"
        >
          {testimonials.map((testimonial) => (
            <motion.div 
              key={testimonial.id} 
              variants={itemVariants} 
              className="medieval-card h-full flex flex-col text-center p-6"
            >
              {/* Optional Avatar */}
              {/* <img 
                src={testimonial.avatar} 
                alt={`${testimonial.name}'s avatar`} 
                className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-accent shadow-md bg-muted"
                onError={(e) => e.currentTarget.style.display = 'none'} // Hide if image fails
              /> */} 
              <span className="text-4xl mb-4">💬</span> {/* Quote Bubble Emoji */}
              <blockquote className="font-medieval text-base text-foreground/90 mb-4 italic leading-relaxed flex-grow">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <div className="mt-auto pt-4 border-t border-border/30">
                 <p className="font-heading text-md text-primary font-semibold">{testimonial.name}</p>
                 <p className="font-medieval text-sm text-muted-foreground">{testimonial.role}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Navigation Button */}
        <motion.div variants={itemVariants} className="flex justify-center mt-12">
          <button 
            className="medieval-button px-8 py-3 text-lg"
            onClick={() => setCurrentZone('contact')}
          >
            Send a Raven (Contact)
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default TestimonialsZone; 