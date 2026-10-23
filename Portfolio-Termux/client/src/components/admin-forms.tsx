import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  children: React.ReactNode;
}

function FormModal({ isOpen, onClose, onSuccess, title, children }: FormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700 text-white">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-700">
          <CardTitle className="text-lg font-bold text-green-400">{title}</CardTitle>
          <Button variant="outline" size="sm" onClick={(e) => {
            e.preventDefault();
            onClose();
          }}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-6">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

export function AddProjectForm({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    techStack: [] as string[],
    liveDemo: '',
    github: '',
    asciiArt: '',
    status: 'development' as 'development' | 'production' | 'archived',
    featured: false
  });
  const [newTech, setNewTech] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest('POST', '/api/projects', formData);
      onSuccess();
      onClose();
      setFormData({
        title: '',
        description: '',
        techStack: [],
        liveDemo: '',
        github: '',
        asciiArt: '',
        status: 'development',
        featured: false
      });
    } catch (error) {
      alert('Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const addTech = () => {
    if (newTech.trim() && !formData.techStack.includes(newTech.trim())) {
      setFormData(prev => ({
        ...prev,
        techStack: [...prev.techStack, newTech.trim()]
      }));
      setNewTech('');
    }
  };

  const removeTech = (tech: string) => {
    setFormData(prev => ({
      ...prev,
      techStack: prev.techStack.filter((t: string) => t !== tech)
    }));
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} title="Add New Project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Project Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            autoFocus
            className="bg-gray-800 border-gray-600 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
            rows={3}
          />
        </div>

        <div>
          <Label>Tech Stack</Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={newTech}
              onChange={(e) => setNewTech(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTech();
                }
              }}
              placeholder="Add technology"
              className="bg-gray-800 border-gray-600 text-white"
            />
            <Button type="button" onClick={addTech} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.techStack.map((tech) => (
              <Badge key={tech} variant="secondary" className="flex items-center gap-1">
                {tech}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTech(tech)}
                  className="h-4 w-4 p-0 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="liveDemo">Live Demo URL (optional)</Label>
          <Input
            id="liveDemo"
            type="url"
            value={formData.liveDemo}
            onChange={(e) => setFormData(prev => ({ ...prev, liveDemo: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="github">GitHub URL (optional)</Label>
          <Input
            id="github"
            type="url"
            value={formData.github}
            onChange={(e) => setFormData(prev => ({ ...prev, github: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
            <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="asciiArt">ASCII Art</Label>
          <Textarea
            id="asciiArt"
            value={formData.asciiArt}
            onChange={(e) => setFormData(prev => ({ ...prev, asciiArt: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white font-mono"
            rows={6}
            placeholder="Enter ASCII art for the project"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="featured"
            checked={formData.featured}
            onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
            className="rounded"
          />
          <Label htmlFor="featured">Featured Project</Label>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={(e) => {
            e.preventDefault();
            onClose();
          }}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function AddSkillForm({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    proficiency: 50,
    yearsOfExperience: 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest('POST', '/api/skills', formData);
      onSuccess();
      onClose();
      setFormData({
        name: '',
        category: '',
        proficiency: 50,
        yearsOfExperience: 1
      });
    } catch (error) {
      alert('Failed to create skill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} title="Add New Skill">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Skill Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            autoFocus
            className="bg-gray-800 border-gray-600 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            placeholder="e.g., Frontend, Backend, Cloud & DevOps"
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="proficiency">Proficiency ({formData.proficiency}%)</Label>
          <input
            type="range"
            id="proficiency"
            min="1"
            max="100"
            value={formData.proficiency}
            onChange={(e) => setFormData(prev => ({ ...prev, proficiency: parseInt(e.target.value) }))}
            className="w-full"
          />
        </div>

        <div>
          <Label htmlFor="experience">Years of Experience</Label>
          <Input
            id="experience"
            type="number"
            min="0"
            max="50"
            value={formData.yearsOfExperience}
            onChange={(e) => setFormData(prev => ({ ...prev, yearsOfExperience: parseInt(e.target.value) }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={(e) => {
            e.preventDefault();
            onClose();
          }}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Creating...' : 'Create Skill'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function AddSocialLinkForm({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    platform: '',
    username: '',
    displayName: '',
    url: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest('POST', '/api/social', formData);
      onSuccess();
      onClose();
      setFormData({
        platform: '',
        username: '',
        displayName: '',
        url: ''
      });
    } catch (error) {
      alert('Failed to create social link');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} title="Add Social Link">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="platform">Platform</Label>
          <Input
            id="platform"
            value={formData.platform}
            onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            placeholder="e.g., GitHub, LinkedIn, Twitter"
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="url"
            value={formData.url}
            onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={(e) => {
            e.preventDefault();
            onClose();
          }}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Creating...' : 'Create Social Link'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function EditBioForm({ isOpen, onClose, onSuccess, initialBio }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; initialBio?: any }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    content: initialBio?.content || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest('PUT', '/api/bio', formData);
      onSuccess();
      onClose();
    } catch (error) {
      alert('Failed to update bio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} title="Edit Bio">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="content">Bio Content</Label>
          <Textarea
            id="content"
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            autoFocus
            className="bg-gray-800 border-gray-600 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
            rows={8}
            placeholder="Write your bio here..."
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={(e) => {
            e.preventDefault();
            onClose();
          }}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Updating...' : 'Update Bio'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function EditStatsForm({ isOpen, onClose, onSuccess, initialStats }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; initialStats?: any }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    stars: initialStats?.stars || 0,
    commits: initialStats?.commits || 0,
    repos: initialStats?.repos || 0,
    followers: initialStats?.followers || 0,
    pullRequests: initialStats?.pullRequests || 0,
    issues: initialStats?.issues || 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest('PUT', '/api/github-stats', formData);
      onSuccess();
      onClose();
    } catch (error) {
      alert('Failed to update GitHub stats');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} title="Update GitHub Statistics">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="stars">Stars</Label>
            <Input
              id="stars"
              type="number"
              min="0"
              value={formData.stars}
              onChange={(e) => setFormData(prev => ({ ...prev, stars: parseInt(e.target.value) || 0 }))}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>

          <div>
            <Label htmlFor="commits">Commits</Label>
            <Input
              id="commits"
              type="number"
              min="0"
              value={formData.commits}
              onChange={(e) => setFormData(prev => ({ ...prev, commits: parseInt(e.target.value) || 0 }))}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>

          <div>
            <Label htmlFor="repos">Repositories</Label>
            <Input
              id="repos"
              type="number"
              min="0"
              value={formData.repos}
              onChange={(e) => setFormData(prev => ({ ...prev, repos: parseInt(e.target.value) || 0 }))}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>

          <div>
            <Label htmlFor="followers">Followers</Label>
            <Input
              id="followers"
              type="number"
              min="0"
              value={formData.followers}
              onChange={(e) => setFormData(prev => ({ ...prev, followers: parseInt(e.target.value) || 0 }))}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>

          <div>
            <Label htmlFor="pullRequests">Pull Requests</Label>
            <Input
              id="pullRequests"
              type="number"
              min="0"
              value={formData.pullRequests}
              onChange={(e) => setFormData(prev => ({ ...prev, pullRequests: parseInt(e.target.value) || 0 }))}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>

          <div>
            <Label htmlFor="issues">Issues</Label>
            <Input
              id="issues"
              type="number"
              min="0"
              value={formData.issues}
              onChange={(e) => setFormData(prev => ({ ...prev, issues: parseInt(e.target.value) || 0 }))}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => e.stopPropagation()}
              className="bg-gray-800 border-gray-600 text-white"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={(e) => {
            e.preventDefault();
            onClose();
          }}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Updating...' : 'Update Stats'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function AddCertificateForm({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    issuer: '',
    dateIssued: new Date().toISOString().split('T')[0],
    credentialUrl: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.title.trim()) throw new Error('Title is required');
      if (!formData.description.trim()) throw new Error('Description is required');
      if (!formData.issuer.trim()) throw new Error('Issuer is required');
      if (!formData.dateIssued) throw new Error('Date is required');

      // Validate date format
      const dateIssued = new Date(formData.dateIssued);
      if (isNaN(dateIssued.getTime())) {
        throw new Error('Invalid date format');
      }

      const response = await apiRequest('POST', '/api/certificates', {
        ...formData,
        dateIssued
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create certificate');
      }

      onSuccess();
      onClose();
      setFormData({
        title: '',
        description: '',
        issuer: '',
        dateIssued: new Date().toISOString().split('T')[0],
        credentialUrl: ''
      });
    } catch (error) {
      console.error('Certificate creation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to create certificate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} title="Add New Certificate">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-500 px-4 py-2 rounded">
            {error}
          </div>
        )}
        
        <div>
          <Label htmlFor="title">Certificate Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            autoFocus
            className="bg-gray-800 border-gray-600 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="issuer">Issuer</Label>
          <Input
            id="issuer"
            value={formData.issuer}
            onChange={(e) => setFormData(prev => ({ ...prev, issuer: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="dateIssued">Date Issued</Label>
          <Input
            id="dateIssued"
            type="date"
            value={formData.dateIssued}
            onChange={(e) => setFormData(prev => ({ ...prev, dateIssued: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="credentialUrl">Credential URL (optional)</Label>
          <Input
            id="credentialUrl"
            type="url"
            value={formData.credentialUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, credentialUrl: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            className="bg-gray-800 border-gray-600 text-white"
            placeholder="https://example.com/credential"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={(e) => {
            e.preventDefault();
            onClose();
          }}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Creating...' : 'Create Certificate'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function EditProjectForm({ isOpen, onClose, onSuccess, project }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; project: any }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: project?.title || '',
    description: project?.description || '',
    techStack: project?.techStack || [],
    liveDemo: project?.liveDemo || '',
    github: project?.github || '',
    asciiArt: project?.asciiArt || '',
    status: project?.status || 'development',
    featured: project?.featured || false
  });
  const [newTech, setNewTech] = useState('');

  useEffect(() => {
    if (project) {
      setFormData({
        title: project.title || '',
        description: project.description || '',
        techStack: project.techStack || [],
        liveDemo: project.liveDemo || '',
        github: project.github || '',
        asciiArt: project.asciiArt || '',
        status: project.status || 'development',
        featured: project.featured || false
      });
    }
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest('PUT', `/api/projects/${project.id}`, formData);
      onSuccess();
      onClose();
    } catch (error) {
      alert('Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  const addTech = () => {
    if (newTech.trim() && !formData.techStack.includes(newTech.trim())) {
      setFormData(prev => ({
        ...prev,
        techStack: [...prev.techStack, newTech.trim()]
      }));
      setNewTech('');
    }
  };

  const removeTech = (tech: string) => {
    setFormData(prev => ({
      ...prev,
      techStack: prev.techStack.filter((t: string) => t !== tech)
    }));
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} title="Edit Project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Project Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            autoFocus
            className="bg-gray-800 border-gray-600 text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
            rows={3}
          />
        </div>

        <div>
          <Label>Tech Stack</Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={newTech}
              onChange={(e) => setNewTech(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              onKeyUp={(e) => e.stopPropagation()}
              onKeyPress={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTech();
                }
              }}
              placeholder="Add technology"
              className="bg-gray-800 border-gray-600 text-white"
            />
            <Button type="button" onClick={addTech} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.techStack.map((tech) => (
              <Badge key={tech} variant="secondary" className="flex items-center gap-1">
                {tech}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTech(tech)}
                  className="h-4 w-4 p-0 hover:bg-red-600"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="liveDemo">Live Demo URL (optional)</Label>
          <Input
            id="liveDemo"
            type="url"
            value={formData.liveDemo}
            onChange={(e) => setFormData(prev => ({ ...prev, liveDemo: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="github">GitHub URL (optional)</Label>
          <Input
            id="github"
            type="url"
            value={formData.github}
            onChange={(e) => setFormData(prev => ({ ...prev, github: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
            <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="development">Development</SelectItem>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="asciiArt">ASCII Art</Label>
          <Textarea
            id="asciiArt"
            value={formData.asciiArt}
            onChange={(e) => setFormData(prev => ({ ...prev, asciiArt: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white font-mono"
            rows={6}
            placeholder="Enter ASCII art for the project"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="featured"
            checked={formData.featured}
            onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
            className="rounded"
          />
          <Label htmlFor="featured">Featured Project</Label>
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Updating...' : 'Update Project'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function EditSkillForm({ isOpen, onClose, onSuccess, skill }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; skill: any }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: skill?.name || '',
    category: skill?.category || '',
    proficiency: skill?.proficiency || 50,
    yearsOfExperience: skill?.yearsOfExperience || 1
  });

  useEffect(() => {
    if (skill) {
      setFormData({
        name: skill.name || '',
        category: skill.category || '',
        proficiency: skill.proficiency || 50,
        yearsOfExperience: skill.yearsOfExperience || 1
      });
    }
  }, [skill]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest('PUT', `/api/skills/${skill.id}`, formData);
      onSuccess();
      onClose();
    } catch (error) {
      alert('Failed to update skill');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} title="Edit Skill">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Skill Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            autoFocus
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            placeholder="e.g., Frontend, Backend, Cloud & DevOps"
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="proficiency">Proficiency ({formData.proficiency}%)</Label>
          <input
            type="range"
            id="proficiency"
            min="1"
            max="100"
            value={formData.proficiency}
            onChange={(e) => setFormData(prev => ({ ...prev, proficiency: parseInt(e.target.value) }))}
            className="w-full"
          />
        </div>

        <div>
          <Label htmlFor="experience">Years of Experience</Label>
          <Input
            id="experience"
            type="number"
            min="0"
            max="50"
            value={formData.yearsOfExperience}
            onChange={(e) => setFormData(prev => ({ ...prev, yearsOfExperience: parseInt(e.target.value) }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Updating...' : 'Update Skill'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}

export function EditCertificateForm({ isOpen, onClose, onSuccess, certificate }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; certificate: any }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: certificate?.title || '',
    description: certificate?.description || '',
    issuer: certificate?.issuer || '',
    dateIssued: certificate?.dateIssued ? new Date(certificate.dateIssued).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    credentialUrl: certificate?.credentialUrl || ''
  });

  useEffect(() => {
    if (certificate) {
      setFormData({
        title: certificate.title || '',
        description: certificate.description || '',
        issuer: certificate.issuer || '',
        dateIssued: certificate.dateIssued ? new Date(certificate.dateIssued).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        credentialUrl: certificate.credentialUrl || ''
      });
    }
  }, [certificate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiRequest('PUT', `/api/certificates/${certificate.id}`, formData);
      onSuccess();
      onClose();
    } catch (error) {
      alert('Failed to update certificate');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} onSuccess={onSuccess} title="Edit Certificate">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Certificate Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            autoFocus
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="issuer">Issuer</Label>
          <Input
            id="issuer"
            value={formData.issuer}
            onChange={(e) => setFormData(prev => ({ ...prev, issuer: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="dateIssued">Date Issued</Label>
          <Input
            id="dateIssued"
            type="date"
            value={formData.dateIssued}
            onChange={(e) => setFormData(prev => ({ ...prev, dateIssued: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            required
            className="bg-gray-800 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label htmlFor="credentialUrl">Credential URL (optional)</Label>
          <Input
            id="credentialUrl"
            type="url"
            value={formData.credentialUrl}
            onChange={(e) => setFormData(prev => ({ ...prev, credentialUrl: e.target.value }))}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
            className="bg-gray-800 border-gray-600 text-white"
            placeholder="https://example.com/credential"
          />
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading ? 'Updating...' : 'Update Certificate'}
          </Button>
        </div>
      </form>
    </FormModal>
  );
}