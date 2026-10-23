import { useState, useEffect } from 'react';
import DialogBox from "@/components/ui/dialog-box";

interface GitHubRepo {
  name: string;
  stargazers_count: number;
  forks_count: number;
  language: string;
}

interface GitHubStats {
  repos: number;
  stars: number;
  forks: number;
  topLanguages: Record<string, number>;
  loading: boolean;
  error: string | null;
}

const GitHubStats = () => {
  const [stats, setStats] = useState<GitHubStats>({
    repos: 0,
    stars: 0,
    forks: 0,
    topLanguages: {},
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchGitHubStats = async () => {
      try {
        // Using per_page parameter to get more repos at once (up to 100)
        const response = await fetch('https://api.github.com/users/ChristopherJoshy/repos?per_page=100', {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          },
          cache: 'no-store'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch GitHub data: ${response.status}`);
        }
        
        const data: GitHubRepo[] = await response.json();
        const repos = data.length;
        const stars = data.reduce((acc, repo) => acc + repo.stargazers_count, 0);
        const forks = data.reduce((acc, repo) => acc + repo.forks_count, 0);
        
        // Calculate top languages
        const languages: Record<string, number> = {};
        data.forEach(repo => {
          if (repo.language) {
            languages[repo.language] = (languages[repo.language] || 0) + 1;
          }
        });
        
        setStats({
          repos,
          stars,
          forks,
          topLanguages: languages,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.error('GitHub API error:', error);
        setStats({
          repos: 20,
          stars: 45,
          forks: 15,
          topLanguages: { 
            "JavaScript": 8,
            "TypeScript": 7,
            "Python": 6,
            "C++": 3,
            "HTML": 2 
          },
          loading: false,
          error: 'Unable to fetch GitHub stats, showing fallback data',
        });
      }
    };

    fetchGitHubStats();
  }, []);

  const getTopLanguages = () => {
    return Object.entries(stats.topLanguages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([language, count]) => `${language}: ${count}`);
  };

  return (
    <DialogBox className="w-full">
      <h2 className="font-pixel text-sm md:text-base text-highlight mb-4">GITHUB STATISTICS</h2>
      
      {stats.loading ? (
        <div className="text-center py-4">
          <div className="animate-pulse-slow text-accent">Loading stats...</div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-primary/30 rounded p-2 text-center">
              <div className="font-pixel text-highlight text-sm md:text-base">{stats.repos}</div>
              <div className="font-pixel-secondary text-xs">Repositories</div>
            </div>
            <div className="bg-primary/30 rounded p-2 text-center">
              <div className="font-pixel text-highlight text-sm md:text-base">{stats.stars}</div>
              <div className="font-pixel-secondary text-xs">Stars</div>
            </div>
            <div className="bg-primary/30 rounded p-2 text-center">
              <div className="font-pixel text-highlight text-sm md:text-base">{stats.forks}</div>
              <div className="font-pixel-secondary text-xs">Forks</div>
            </div>
          </div>
          
          <div className="mt-4">
            <h3 className="font-pixel text-accent text-xs mb-2">TOP LANGUAGES</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {getTopLanguages().map((lang, index) => (
                <div key={index} className="bg-primary/30 rounded p-1 font-pixel-secondary text-xs">
                  {lang}
                </div>
              ))}
            </div>
          </div>
          
          {stats.error && (
            <div className="text-xs text-accent mt-2 italic">{stats.error}</div>
          )}
        </div>
      )}
    </DialogBox>
  );
};

export default GitHubStats;