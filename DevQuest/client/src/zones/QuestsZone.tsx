import { motion } from "framer-motion";
import DialogBox from "@/components/ui/dialog-box";
import XPBar from "@/components/ui/xp-bar";
import PixelButton from "@/components/ui/pixel-button";
import { useGameStore } from "@/store/gameStore";
import { quests } from "@/data/quests";

const QuestsZone = () => {
  const { setCurrentZone } = useGameStore();
  
  const activeQuests = quests.filter(quest => quest.status === "active");
  const futureQuests = quests.filter(quest => quest.status === "locked");

  return (
    <motion.div 
      id="quests" 
      className="zone min-h-screen p-4 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="absolute inset-0 bg-medieval-auto z-0">
        <div className="absolute inset-0 bg-background opacity-70"></div>
      </div>
      
      <div className="relative z-10 max-w-5xl mx-auto">
        <h1 className="font-pixel text-lg md:text-2xl text-highlight text-center mb-8">QUEST BOARD</h1>
        <p className="font-pixel-secondary text-sm md:text-base text-center mb-12">Current adventures and future challenges...</p>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Active Quests */}
          <div>
            <h2 className="font-pixel text-base text-accent mb-6">ACTIVE QUESTS</h2>
            
            <div className="space-y-4">
              {activeQuests.map((quest) => (
                <DialogBox key={quest.id} className="p-4">
                  <div className="flex items-start mb-2">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mr-3">
                      <img src={quest.icon} alt={quest.title} className="w-6 h-6 pixelated" />
                    </div>
                    <div>
                      <div className="font-pixel text-xs text-highlight mb-1">{quest.title}</div>
                      <div className="font-pixel-secondary text-xs">{quest.description}</div>
                    </div>
                  </div>
                  <XPBar level={quest.progress} />
                  <div className="font-pixel-secondary text-right text-xs mt-1">{quest.progress}% Complete</div>
                </DialogBox>
              ))}
            </div>
          </div>
          
          {/* Future Quests */}
          <div>
            <h2 className="font-pixel text-base text-accent mb-6">FUTURE QUESTS</h2>
            
            <div className="space-y-4">
              {futureQuests.map((quest) => (
                <DialogBox key={quest.id} className="p-4 opacity-70">
                  <div className="flex items-start mb-2">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center mr-3">
                      <img src={quest.icon} alt={quest.title} className="w-6 h-6 pixelated" />
                    </div>
                    <div>
                      <div className="font-pixel text-xs text-highlight mb-1">{quest.title}</div>
                      <div className="font-pixel-secondary text-xs">{quest.description}</div>
                    </div>
                  </div>
                  <div className="font-pixel-secondary text-xs mt-1 text-accent">QUEST LOCKED</div>
                </DialogBox>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex justify-center mt-12">
          <PixelButton onClick={() => setCurrentZone('contact')}>
            ENTER PORTAL ROOM
          </PixelButton>
        </div>
      </div>
    </motion.div>
  );
};

export default QuestsZone;
