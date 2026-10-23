import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useProjects() {
  return useQuery({
    queryKey: ['/api/projects'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['/api/projects', id],
    enabled: !!id,
  });
}

export function useSkills() {
  return useQuery({
    queryKey: ['/api/skills'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useSocialLinks() {
  return useQuery({
    queryKey: ['/api/social'],
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useBio() {
  return useQuery({
    queryKey: ['/api/bio'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useGithubStats() {
  return useQuery({
    queryKey: ['/api/github-stats'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useMessages() {
  return useQuery({
    queryKey: ['/api/messages'],
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

export function useAsciiArt() {
  return useQuery({
    queryKey: ['/api/ascii-art'],
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { name: string; email: string; message: string }) => {
      const res = await apiRequest('POST', '/api/messages', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
      toast({
        title: "Message sent successfully!",
        description: "I'll get back to you within 24 hours.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useAdminAuth() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest('POST', '/api/admin/auth', { password });
      return res.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Authentication failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useAdminLogout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/logout');
      return res.json();
    },
    onSuccess: () => {
      // Invalidate all admin-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/messages'] });
    },
  });
}
