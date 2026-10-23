import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X, Eye, Edit, Trash2, Plus, RefreshCw } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { 
  AddProjectForm, 
  AddSkillForm, 
  AddSocialLinkForm, 
  EditBioForm, 
  EditStatsForm, 
  AddCertificateForm,
  EditProjectForm,
  EditSkillForm,
  EditCertificateForm
} from './admin-forms';
import { EditSocialLinkForm } from './admin-edit-social-link-form';

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState<any>({
    projects: [],
    skills: {},
    certificates: [],
    socialLinks: [],
    messages: [],
    bio: null,
    stats: null
  });
  const [loading, setLoading] = useState(true);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showAddSocial, setShowAddSocial] = useState(false);
  const [showEditBio, setShowEditBio] = useState(false);
  const [showEditStats, setShowEditStats] = useState(false);
  const [isAddCertificateOpen, setIsAddCertificateOpen] = useState(false);
  
  // New state variables for edit forms
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editingSkill, setEditingSkill] = useState<any>(null);
  const [editingCertificate, setEditingCertificate] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projects, skills, certificates, socialLinks, messages, bio, stats] = await Promise.all([
        apiRequest('GET', '/api/projects').then(r => r.json()).catch(() => []),
        apiRequest('GET', '/api/skills').then(r => r.json()).catch(() => ({})),
        apiRequest('GET', '/api/certificates').then(r => r.json()).catch(() => []),
        apiRequest('GET', '/api/social').then(r => r.json()).catch(() => []),
        apiRequest('GET', '/api/messages').then(r => r.json()).catch(() => []),
        apiRequest('GET', '/api/bio').then(r => r.json()).catch(() => null),
        apiRequest('GET', '/api/github-stats').then(r => r.json()).catch(() => null)
      ]);

      setData({
        projects,
        skills,
        certificates,
        socialLinks,
        messages,
        bio,
        stats
      });
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteItem = async (endpoint: string, id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      try {
        await apiRequest('DELETE', `${endpoint}/${id}`);
        await loadData();
      } catch (error) {
        alert('Failed to delete item');
      }
    }
  };

  const handleMarkMessageRead = async (id: string) => {
    try {
      await apiRequest('PATCH', `/api/messages/${id}`, { read: true });
      await loadData();
    } catch (error) {
      alert('Failed to mark message as read');
    }
  };

  const handleViewItem = (type: string, item: any) => {
    const itemData = JSON.stringify(item, null, 2);
    alert(`${type} Details:\n\n${itemData}`);
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
  };

  const handleEditSkill = (skill: any) => {
    setEditingSkill(skill);
  };

  const handleEditSocialLink = (link: any) => {
    alert(`Edit Social Link: ${link.displayName}\n\nPlatform: ${link.platform}\nUsername: ${link.username}\nURL: ${link.url}`);
  };

  const handleEditCertificate = (certificate: any) => {
    setEditingCertificate(certificate);
  };

  const handleFormSuccess = () => {
    loadData();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" role="dialog" aria-modal="true">
        <Card className="bg-gray-900 border-gray-700 text-white">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading admin panel...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-6xl h-[90vh] bg-gray-900 border-gray-700 text-white">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-700">
          <CardTitle className="text-xl font-bold text-green-400">
            🛠️ Admin Control Panel
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={(e) => {
              e.preventDefault();
              loadData();
            }}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={(e) => {
              e.preventDefault();
              onClose();
            }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 h-full">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid grid-cols-7 gap-1 p-1 bg-gray-800 m-2">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="certificates">Certificates</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="bio">Bio & Stats</TabsTrigger>
            </TabsList>

            <div className="px-4 pb-4 h-[calc(100%-120px)]">
              <TabsContent value="overview" className="h-full">
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="bg-gray-800 border-gray-600">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-400">{data.projects.length}</div>
                        <div className="text-sm text-gray-300">Projects</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-600">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-400">
                          {Object.values(data.skills).flat().length}
                        </div>
                        <div className="text-sm text-gray-300">Skills</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-600">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-purple-400">{data.socialLinks.length}</div>
                        <div className="text-sm text-gray-300">Social Links</div>
                      </CardContent>
                    </Card>
                    <Card className="bg-gray-800 border-gray-600">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-red-400">
                          {data.messages.filter((m: any) => !m.read).length}
                        </div>
                        <div className="text-sm text-gray-300">Unread Messages</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-green-400">Recent Activity</h3>
                    <div className="space-y-2">
                      {data.messages.slice(0, 5).map((message: any) => (
                        <Card key={message.id} className="bg-gray-800 border-gray-600">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{message.name}</div>
                                <div className="text-sm text-gray-400">{message.email}</div>
                                <div className="text-xs text-gray-500">
                                  {new Date(message.timestamp).toLocaleDateString()}
                                </div>
                              </div>
                              <Badge variant={message.read ? "secondary" : "destructive"}>
                                {message.read ? 'Read' : 'Unread'}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="projects" className="h-full">
                <ScrollArea className="h-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-green-400">Projects ({data.projects.length})</h3>
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowAddProject(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Project
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {data.projects.map((project: any) => (
                      <Card key={project.id} className="bg-gray-800 border-gray-600">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold text-white">[{project.id}] {project.title}</h4>
                              <Badge variant="outline" className="mt-1">{project.status}</Badge>
                            </div>
                            <div className="flex space-x-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleViewItem('Project', project);
                                }}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleEditProject(project);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDeleteItem('/api/projects', project.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-300 mb-2">{project.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {project.techStack?.slice(0, 5).map((tech: string, idx: number) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="skills" className="h-full">
                <ScrollArea className="h-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-green-400">Skills by Category</h3>
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowAddSkill(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Skill
                    </Button>
                  </div>
                  <div className="space-y-6">
                    {Object.entries(data.skills).map(([category, skills]) => (
                      <div key={category}>
                        <h4 className="font-semibold text-blue-400 mb-3">{category}</h4>
                        <div className="grid gap-3">
                          {(skills as any[]).map((skill: any) => (
                            <Card key={skill.id} className="bg-gray-800 border-gray-600">
                              <CardContent className="p-3">
                                <div className="flex justify-between items-center">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="font-medium">[{skill.id}] {skill.name}</span>
                                      <span className="text-sm text-gray-400">
                                        {skill.proficiency}% ({skill.yearsOfExperience}y)
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                      <div 
                                        className="bg-blue-500 h-2 rounded-full"
                                        style={{ width: `${skill.proficiency}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex space-x-1 ml-4">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleEditSkill(skill);
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        handleDeleteItem('/api/skills', skill.id);
                                      }}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="certificates" className="h-full">
                <ScrollArea className="h-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-green-400">Certificates ({data.certificates.length})</h3>
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => setIsAddCertificateOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Certificate
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {data.certificates.map((cert: any) => (
                      <Card key={cert.id} className="bg-gray-800 border-gray-600">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold text-white">[{cert.id}] {cert.title}</h4>
                              <p className="text-sm text-gray-300">{cert.issuer}</p>
                              <p className="text-xs text-gray-400">
                                Issued: {new Date(cert.dateIssued).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex space-x-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleEditCertificate(cert);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDeleteItem('/api/certificates', cert.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="social" className="h-full">
                <ScrollArea className="h-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-green-400">Social Links ({data.socialLinks.length})</h3>
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowAddSocial(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Social Link
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {data.socialLinks.map((link: any) => (
                      <Card key={link.id} className="bg-gray-800 border-gray-600">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-semibold text-white">[{link.id}] {link.displayName}</h4>
                              <p className="text-sm text-gray-300">{link.platform} - {link.username}</p>
                              <p className="text-xs text-gray-400 truncate">{link.url}</p>
                            </div>
                            <div className="flex space-x-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleEditSocialLink(link);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDeleteItem('/api/social', link.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="messages" className="h-full">
                <ScrollArea className="h-full">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-green-400">
                      Messages ({data.messages.length}) - 
                      {data.messages.filter((m: any) => !m.read).length} unread
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {data.messages.map((message: any) => (
                      <Card key={message.id} className="bg-gray-800 border-gray-600">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold text-white">
                                [{message.id}] {message.name} 
                                <Badge 
                                  variant={message.read ? "secondary" : "destructive"}
                                  className="ml-2"
                                >
                                  {message.read ? 'Read' : 'Unread'}
                                </Badge>
                              </h4>
                              <p className="text-sm text-gray-300">{message.email}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(message.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex space-x-1">
                              {!message.read && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleMarkMessageRead(message.id);
                                  }}
                                >
                                  Mark Read
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleDeleteItem('/api/messages', message.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <Separator className="my-2 bg-gray-600" />
                          <p className="text-sm text-gray-300">{message.message}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="bio" className="h-full">
                <ScrollArea className="h-full">
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-green-400">Bio Information</h3>
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowEditBio(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit Bio
                        </Button>
                      </div>
                      <Card className="bg-gray-800 border-gray-600">
                        <CardContent className="p-4">
                          <p className="text-sm text-gray-300 whitespace-pre-wrap">
                            {data.bio?.content || 'No bio information available'}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-green-400">GitHub Statistics</h3>
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700"
                          onClick={(e) => {
                            e.preventDefault();
                            setShowEditStats(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Update Stats
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {data.stats ? (
                          <>
                            <Card className="bg-gray-800 border-gray-600">
                              <CardContent className="p-4 text-center">
                                <div className="text-2xl font-bold text-yellow-400">{data.stats.stars}</div>
                                <div className="text-sm text-gray-300">Stars</div>
                              </CardContent>
                            </Card>
                            <Card className="bg-gray-800 border-gray-600">
                              <CardContent className="p-4 text-center">
                                <div className="text-2xl font-bold text-green-400">{data.stats.commits}</div>
                                <div className="text-sm text-gray-300">Commits</div>
                              </CardContent>
                            </Card>
                            <Card className="bg-gray-800 border-gray-600">
                              <CardContent className="p-4 text-center">
                                <div className="text-2xl font-bold text-blue-400">{data.stats.repos}</div>
                                <div className="text-sm text-gray-300">Repositories</div>
                              </CardContent>
                            </Card>
                            <Card className="bg-gray-800 border-gray-600">
                              <CardContent className="p-4 text-center">
                                <div className="text-2xl font-bold text-purple-400">{data.stats.followers}</div>
                                <div className="text-sm text-gray-300">Followers</div>
                              </CardContent>
                            </Card>
                            <Card className="bg-gray-800 border-gray-600">
                              <CardContent className="p-4 text-center">
                                <div className="text-2xl font-bold text-red-400">{data.stats.pullRequests}</div>
                                <div className="text-sm text-gray-300">Pull Requests</div>
                              </CardContent>
                            </Card>
                            <Card className="bg-gray-800 border-gray-600">
                              <CardContent className="p-4 text-center">
                                <div className="text-2xl font-bold text-orange-400">{data.stats.issues}</div>
                                <div className="text-sm text-gray-300">Issues</div>
                              </CardContent>
                            </Card>
                          </>
                        ) : (
                          <Card className="bg-gray-800 border-gray-600 col-span-full">
                            <CardContent className="p-4 text-center">
                              <p className="text-gray-400">No GitHub statistics available</p>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add Forms */}
      <AddProjectForm 
        isOpen={showAddProject} 
        onClose={() => setShowAddProject(false)} 
        onSuccess={handleFormSuccess} 
      />
      <AddSkillForm 
        isOpen={showAddSkill} 
        onClose={() => setShowAddSkill(false)} 
        onSuccess={handleFormSuccess} 
      />
      <AddSocialLinkForm 
        isOpen={showAddSocial} 
        onClose={() => setShowAddSocial(false)} 
        onSuccess={handleFormSuccess} 
      />
      <EditBioForm 
        isOpen={showEditBio} 
        onClose={() => setShowEditBio(false)} 
        onSuccess={handleFormSuccess}
        initialBio={data.bio}
      />
      <EditStatsForm 
        isOpen={showEditStats} 
        onClose={() => setShowEditStats(false)} 
        onSuccess={handleFormSuccess}
        initialStats={data.stats}
      />
      <AddCertificateForm
        isOpen={isAddCertificateOpen}
        onClose={() => setIsAddCertificateOpen(false)}
        onSuccess={handleFormSuccess}
      />

      {/* Edit Forms */}
      <EditProjectForm
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        onSuccess={handleFormSuccess}
        project={editingProject}
      />
      <EditSkillForm
        isOpen={!!editingSkill}
        onClose={() => setEditingSkill(null)}
        onSuccess={handleFormSuccess}
        skill={editingSkill}
      />
      <EditCertificateForm
        isOpen={!!editingCertificate}
        onClose={() => setEditingCertificate(null)}
        onSuccess={handleFormSuccess}
        certificate={editingCertificate}
      />
    </div>
  );
}