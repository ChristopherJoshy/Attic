import { CommandContext, CommandResult } from "@/types/terminal";
import { apiRequest } from "./queryClient";
import { ASCII_ART, createProgressAnimation, createProjectBanner } from "./ascii-art";

export class TerminalCommands {
  private adminPassword = "passwordissoory";

  async executeCommand(command: string, context: CommandContext): Promise<CommandResult> {
    const [cmd, ...args] = command.trim().split(' ');
    
    try {
      switch (cmd.toLowerCase()) {
        case 'help':
          return this.handleHelp(context);
        case 'about':
          return this.handleAbout();
        case 'skills':
          return this.handleSkills();
        case 'projects':
          return this.handleProjects(args);
        case 'project':
          return this.handleProjectDetail(args);
        case 'contact':
          return this.handleContact(args);
        case 'resume':
          return this.handleResume();
        case 'social':
          return this.handleSocial();
        case 'fastfetch':
          return this.handleFastfetch();
        case 'clear':
          return { output: '', success: true, shouldClear: true };
        case 'sudo':
          return this.handleSudo(args);
        case 'admin':
          return this.handleAdminAuth(args);
        case 'exit':
          return this.handleExit(context);
        
        // Admin commands
        case 'add':
          return context.isAdminMode ? this.handleAdd(args) : this.commandNotFound(cmd);
        case 'edit':
          return context.isAdminMode ? this.handleEdit(args) : this.commandNotFound(cmd);
        case 'delete':
          return context.isAdminMode ? this.handleDelete(args) : this.commandNotFound(cmd);
        case 'update':
          return context.isAdminMode ? this.handleUpdate(args) : this.commandNotFound(cmd);
        case 'view':
          return context.isAdminMode ? this.handleView(args) : this.commandNotFound(cmd);
        
        // Linux-like commands
        case 'echo':
          return this.handleEcho(args);
        case 'ping':
          return await this.handlePing(args);
        case 'cat':
          return await this.handleCat(args);
        case 'whoami':
          return this.handleWhoami();
        case 'pwd':
          return this.handlePwd();
        case 'date':
          return this.handleDate();
        case 'uptime':
          return this.handleUptime();
        case 'ls':
          return this.handleLs();
        
        default:
          return this.commandNotFound(cmd);
      }
    } catch (error) {
      return {
        output: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private handleHelp(context: CommandContext): CommandResult {
    if (context.isAdminMode) {
      return {
        output: `🛠️  Admin Commands\n│\n` +
        `│ Content Management\n` +
        `│ ├─ add project         → Add new project with ASCII banner\n` +
        `│ ├─ edit project <id>   → Edit existing project details\n` +
        `│ ├─ delete project <id> → Remove project from database\n` +
        `│ ├─ add skill           → Add new skill to tech stack\n` +
        `│ ├─ add certificate     → Add new certification\n` +
        `│ ├─ update social <platform> → Update social media links\n` +
        `│ └─ update bio          → Edit about section content\n` +
        `│\n` +
        `│ System Management\n` +
        `│ ├─ view messages       → Read contact form submissions\n` +
        `│ ├─ delete message <id> → Remove contact message\n` +
        `│ ├─ update stats        → Refresh GitHub statistics\n` +
        `│ └─ update ascii        → Edit fastfetch ASCII art\n` +
        `│\n` +
        `│ Session\n` +
        `│ ├─ exit               → Exit admin mode\n` +
        `│ └─ logout             → End admin session\n` +
        `│\n` +
        `│ ⚠️  All changes are immediately saved to Firebase Firestore.`,
        success: true
      };
    }

    return {
      output: `📋 Available Commands\n│\n` +
        `│ Navigation\n` +
        `│ ├─ help       → Show this command list\n` +
        `│ ├─ clear      → Clear the terminal screen\n` +
        `│ └─ exit       → Exit the terminal\n` +
        `│\n` +
        `│ Portfolio\n` +
        `│ ├─ about      → Display bio and background\n` +
        `│ ├─ skills     → List current tech stack\n` +
        `│ ├─ projects   → List and view project details\n` +
        `│ ├─ contact    → Fill and submit contact message\n` +
        `│ ├─ resume     → Show GitHub stats and resume link\n` +
        `│ ├─ social     → Show Gmail, GitHub, LinkedIn, Instagram\n` +
        `│ └─ fastfetch  → Display ASCII system info\n` +
        `│\n` +
        `│ Pro tip: Use ↑ ↓ for command history\n` +
        `│ Easter egg: Try 'sudo hire-christopher'`,
      success: true
    };
  }

  private async handleAbout(): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/bio');
      const bio = await response.json();
      
      if (!bio || !bio.content) {
        return {
          output: `No bio information available. Use the admin panel to add bio content.\nRun "admin <password>" to access admin mode.`,
          success: false
        };
      }

      const output = `👨‍💻 About Me\n│\n`;
      const lines = bio.content.split('\n').map((line: string) => `│ ${line}`).join('\n');
      
      return {
        output: output + lines + `\n│\n│ Last updated: ${bio.lastUpdated ? new Date(bio.lastUpdated).toLocaleDateString() : 'Unknown'}`,
        success: true
      };
    } catch (error) {
      return {
        output: 'Failed to load bio information. Please try again later.',
        success: false
      };
    }
  }

  private async handleSkills(): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/skills');
      const skillsByCategory = await response.json();
      
      if (!skillsByCategory || Object.keys(skillsByCategory).length === 0) {
        return {
          output: 'No skills found. Use the admin panel to add skills first.\nRun "admin <password>" to access admin mode.',
          success: false
        };
      }

      const WIDTH = 90;
      let output = '💻 Technical Skills\n│\n';

      // Function to create a fancy proficiency bar
      const createProficiencyBar = (proficiency: number): string => {
        const fullBlocks = Math.floor(proficiency / 10);
        const remainingBlock = proficiency % 10 >= 5 ? 1 : 0;
        const emptyBlocks = 10 - fullBlocks - remainingBlock;
        
        return '█'.repeat(fullBlocks) + 
               (remainingBlock ? '▌' : '') + 
               '░'.repeat(emptyBlocks);
      };

      // Function to get proficiency level text
      const getProficiencyText = (proficiency: number): string => {
        if (proficiency >= 90) return 'Expert';
        if (proficiency >= 80) return 'Advanced';
        if (proficiency >= 60) return 'Intermediate';
        if (proficiency >= 40) return 'Competent';
        return 'Beginner';
      };

      // Function to get category emoji
      const getCategoryEmoji = (category: string): string => {
        const emojiMap: { [key: string]: string } = {
          'Frontend': '🎨',
          'Backend': '⚙️',
          'Database': '🗄️',
          'DevOps': '🚀',
          'Mobile': '📱',
          'Languages': '📝',
          'Tools': '🛠️',
          'Testing': '🧪',
          'Cloud': '☁️',
          'Other': '🔧'
        };
        return emojiMap[category] || '📌';
      };

      // Process each category
      Object.entries(skillsByCategory).forEach(([category, skills], categoryIndex, categories) => {
        const emoji = getCategoryEmoji(category);
        const isLast = categoryIndex === categories.length - 1;
        
        // Category header
        output += `│ ${emoji} ${category}\n│ ${isLast ? '└' : '├'}${'─'.repeat(WIDTH - 4)}\n│\n`;
        
        // Sort skills by proficiency
        const sortedSkills = (skills as any[]).sort((a, b) => b.proficiency - a.proficiency);
        
        // Display skills with fancy bars and proficiency levels
        sortedSkills.forEach((skill, index) => {
          const bar = createProficiencyBar(skill.proficiency);
          const level = getProficiencyText(skill.proficiency);
          const proficiencyText = `${skill.proficiency}% - ${level}`;
          
          // Skill name with experience years if available
          const nameText = skill.yearsOfExperience 
            ? `${skill.name} (${skill.yearsOfExperience}+ years)`
            : skill.name;
          
          output += `│ ${nameText.padEnd(25)} ${bar} ${proficiencyText.padEnd(20)}\n`;
          
          // Add description if available
          if (skill.description) {
            const descLines = skill.description.split('\n');
            descLines.forEach((line: string) => {
              output += `│ ${' '.repeat(27)}${line}\n`;
            });
          }
        });
        
        // Add spacing between categories
        output += '│\n';
      });

      // Add legend at the bottom
      output += `│ Legend\n│ ${'─'.repeat(WIDTH - 4)}\n│\n`;
      output += `│ Proficiency Scale:\n`;
      output += `│ ██████████ Expert      (90-100%)\n`;
      output += `│ ████████░░ Advanced    (80-89%)\n`;
      output += `│ ██████░░░░ Intermediate (60-79%)\n`;
      output += `│ ████░░░░░░ Competent   (40-59%)\n`;
      output += `│ ██░░░░░░░░ Beginner    (0-39%)\n│`;

      return {
        output,
        success: true
      };
    } catch (error) {
      return {
        output: 'Failed to load skills information. Please try again later.',
        success: false
      };
    }
  }

  private async handleProjects(args: string[]): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/projects');
      const projects = await response.json();
      
      if (!projects || projects.length === 0) {
        return {
          output: 'No projects found. Use the admin panel to add projects first.\nRun "admin <password>" to access admin mode.',
          success: false
        };
      }

      let output = 'Loading projects...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += '📂 Projects:\n\n';

      projects.forEach((project: any, index: number) => {
        output += `  ${(index + 1).toString().padEnd(2)} │ ${project.title}\n`;
      });

      output += `\nType 'project [number]' to view details (e.g., 'project 1')`;

      return {
        output,
        success: true,
        loading: {
          message: 'Loading projects...',
          progress: 100,
          duration: 2000
        }
      };
    } catch (error) {
      return {
        output: 'Failed to load projects information. Please try again later.',
        success: false
      };
    }
  }

  private async handleProjectDetail(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        output: 'Usage: project <number>\nExample: project 1',
        success: false
      };
    }

    const projectIndex = parseInt(args[0]) - 1;
    
    try {
      const response = await apiRequest('GET', '/api/projects');
      const projects = await response.json();
      
      if (!projects || projects.length === 0) {
        return {
          output: 'No projects found. Use the admin panel to add projects first.\nRun "admin <password>" to access admin mode.',
          success: false
        };
      }

      if (projectIndex < 0 || projectIndex >= projects.length) {
        return {
          output: 'Project not found. Use "projects" to see available projects.',
          success: false
        };
      }

      const project = projects[projectIndex];
      const WIDTH = 90;
      
      // Title - centered, no border
      let output = `${' '.repeat(Math.floor((WIDTH - project.title.length) / 2))}${project.title.toUpperCase()}${' '.repeat(Math.ceil((WIDTH - project.title.length) / 2))}\n\n`;

      // About section
      output += '📋 About\n';
      
      // Overview with left border
      output += '│\n│ ✨ Overview:\n│\n';
      
      // Description with word wrap and left border
      const words = project.description.split(' ');
      let line = '│ ';
      for (const word of words) {
        if ((line + word).length > WIDTH - 2) {
          output += line + '\n';
          line = '│ ' + word + ' ';
        } else {
          line += word + ' ';
        }
      }
      if (line !== '│ ') {
        output += line + '\n';
      }
      output += '│\n';

      // Key Features section
      if (project.description.includes('✨') || project.description.includes('•')) {
        output += '│ ✨ Key Features:\n│\n';
        
        // Extract and format features
        const features: string[] = project.description
          .split('\n')
          .filter((line: string): boolean => 
            line.trim().startsWith('•') || 
            line.trim().startsWith('✨') || 
            line.trim().startsWith('📚'))
          .map((feature: string): string => feature.trim());
        
        // Display features in a clean list
        for (const feature of features) {
          const cleanFeature = feature
            .replace(/^[•✨📚]\s*/, '') // Remove bullet points
            .trim();
          output += `│ ⭐ ${cleanFeature}\n`;
        }
        output += '│\n';
      }

      // Purpose section if it exists in description
      if (project.description.toLowerCase().includes('purpose')) {
        output += '│ 🎯 Purpose:\n│\n';
        const purposeSection = project.description
          .split('\n')
          .find((line: string) => line.toLowerCase().includes('purpose'));
        if (purposeSection) {
          output += `│ ${purposeSection.replace(/^[^:]+:\s*/, '')}\n│\n`;
        }
      }
      
      output += '\n';

      // Technologies section
      output += '🛠️  Technologies\n│\n';
      const techStackStr = project.techStack.join(', ');
      output += `│ ${techStackStr}\n`;
      output += '│\n\n';
      
      // Links section
      if (project.github || project.liveDemo) {
        output += '🔗 Links\n│\n';
        if (project.github) {
          output += `│ 📦 Repository    ${project.github}\n`;
        }
        if (project.liveDemo) {
          output += `│ 🌐 Live Demo     ${project.liveDemo}\n`;
        }
        output += '│\n\n';
      }
      
      // Status section
      output += '📊 Project Status\n│\n';
      const statusEmoji = project.status === 'production' ? '✅' : 
                         project.status === 'development' ? '🚧' : 
                         '📦';
      const statusText = project.status === 'production' ? 'Production Ready' : 
                        project.status === 'development' ? 'In Development' : 
                        'Archived';
      output += `│ ${statusEmoji} ${statusText}\n`;
      output += '│';

      return {
        output,
        success: true
      };
    } catch (error) {
      return {
        output: 'Failed to load project details. Please try again later.',
        success: false
      };
    }
  }

  private async handleContact(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        output: `📧 Contact Form\n│\n` +
          `│ Send me a message using the following format:\n` +
          `│ contact "Your Name" "Your Email" "Your Message"\n` +
          `│\n` +
          `│ Example:\n` +
          `│ contact "John Doe" "john@example.com" "Hey, let's work together!"`,
        success: true
      };
    }

    return this.sendContactMessage(args);
  }

  private async sendContactMessage(args: string[]): Promise<CommandResult> {
    if (args.length < 3) {
      return {
        output: '❌ Usage: contact send "<name>" "<email>" "<message>"',
        success: false
      };
    }

    const [name, email, message] = args.map(arg => arg.replace(/"/g, ''));

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        output: '❌ Please provide a valid email address.',
        success: false
      };
    }

    if (name.length < 2) {
      return {
        output: '❌ Please provide a valid name (at least 2 characters).',
        success: false
      };
    }

    if (message.length < 1) {
      return {
        output: '❌ Please provide a message with at least 1 characters.',
        success: false
      };
    }

    try {
      const messageData = { name, email, message };
      
      // Send to both backend and Formspree in parallel
      const [backendResponse, formspreeResponse] = await Promise.all([
        // Backend API request
        apiRequest('POST', '/api/messages', messageData),
        
        // Formspree API request
        fetch('https://formspree.io/f/mjkrzrla', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            email: email,
            message: message
          })
        })
      ]);

      // Check if both requests were successful
      if (!backendResponse.ok || !formspreeResponse.ok) {
        throw new Error('Failed to send message to one or more endpoints');
      }

      let output = 'Sending message...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += '✅ Message sent successfully!\n\n';
      output += `📨 From: ${name} <${email}>\n`;
      output += `📝 Message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}\n\n`;
      output += '🕐 You can expect a response within 24 hours.\n';
      output += '📧 Feel free to also email me directly: christopherjoshy4@gmail.com';

      return {
        output,
        success: true,
        loading: {
          message: 'Sending message...',
          progress: 100,
          duration: 3000
        }
      };
    } catch (error) {
      return {
        output: `❌ Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}\nPlease try again or email me directly at christopherjoshy4@gmail.com`,
        success: false
      };
    }
  }

  private async handleResume(): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/resume');
      const resume = await response.json();
      
      if (!resume || !resume.url) {
        return {
          output: 'Resume information not found. Please try again later.',
          success: false
        };
      }

      let output = `📄 Resume & Stats\n│\n`;
      
      if (resume.githubStats) {
        output += `│ GitHub Statistics\n│\n`;
        Object.entries(resume.githubStats).forEach(([key, value]) => {
          output += `│ ${key.padEnd(20, ' ')} ${value}\n`;
        });
        output += '│\n';
      }

      output += `│ Resume\n│\n` +
        `│ 📎 View/Download: ${resume.url}\n` +
        `│ Last updated: ${resume.lastUpdated ? new Date(resume.lastUpdated).toLocaleDateString() : 'Unknown'}\n│`;

      return {
        output,
        success: true
      };
    } catch (error) {
      return {
        output: 'Failed to load resume information. Please try again later.',
        success: false
      };
    }
  }

  private async handleSocial(): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/social');
      const links = await response.json();
      
      if (!links || !Array.isArray(links) || links.length === 0) {
        return {
          output: 'No social links found. Use the admin panel to add social links first.\nRun "admin <password>" to access admin mode.',
          success: false
        };
      }

      let output = '🔗 Social Links\n│\n';
      
      links.forEach(link => {
        const icon = this.getSocialIcon(link.platform);
        output += `│ ${icon} ${link.platform.charAt(0).toUpperCase() + link.platform.slice(1).padEnd(15, ' ')} ${link.url}\n`;
      });

      return {
        output: output + '│',
        success: true
      };
    } catch (error) {
      return {
        output: 'Failed to load social links. Please try again later.',
        success: false
      };
    }
  }

  private async handleFastfetch(): Promise<CommandResult> {
    try {
      const lines = ASCII_ART.FASTFETCH.split('\n');
      let output = '';
      
      // Add left border to each line
      lines.forEach((line: string) => {
        output += `│ ${line}\n`;
      });

      return {
        output,
        success: true
      };
    } catch (error) {
      return {
        output: 'Failed to load ASCII art. Please try again later.',
        success: false
      };
    }
  }

  private async handleSudo(args: string[]): Promise<CommandResult> {
    if (args.join(' ') === 'hire-christopher') {
      const lines = [
        '🎉 Excellent choice! Here\'s what happens next:',
        '',
        '1. Your team gains a passionate developer',
        '2. Code quality improves dramatically',
        '3. Projects get shipped faster',
        '4. Everyone is happier',
        '',
        'To proceed with this upgrade, please:',
        '1. Check out my resume above (run "resume")',
        '2. Connect on LinkedIn (run "social")',
        '3. Send me a message (run "contact")',
        '',
        'I look forward to creating amazing things together! 🚀'
      ];

      let output = '🔑 Sudo Access Granted\n│\n';
      lines.forEach((line: string) => {
        output += line ? `│ ${line}\n` : '│\n';
      });
      output += '│';

      return {
        output,
        success: true
      };
    }

    return {
      output: `🚫 Permission denied: Nice try! But 'sudo' only works with 'hire-christopher' 😉`,
      success: false
    };
  }

  private async handleAdminAuth(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        output: 'Usage: admin <password> [--gui]',
        success: false
      };
    }

    const password = args[0];
    const isGuiMode = args.includes('--gui');
    
    if (password === this.adminPassword) {
      try {
        await apiRequest('POST', '/api/admin/auth', { password });
        
        if (isGuiMode) {
          // Trigger GUI mode via window event
          window.dispatchEvent(new CustomEvent('openAdminGui'));
          return {
            output: '🖥️  Opening Admin GUI Panel...',
            success: true
          };
        } else {
          let output = 'Verifying credentials...\n';
          output += '[████████████████████████████████████████████████████] 100%\n';
          output += '✅ Admin mode enabled. Type \'help\' to view admin-only commands.\n\n';
          output += 'Pro tip: Use "admin <password  parayulla> --gui" for graphical interface!';

          return {
            output,
            success: true,
            loading: {
              message: 'Verifying credentials...',
              progress: 100,
              duration: 2000
            }
          };
        }
      } catch (error) {
        return {
          output: '❌ Authentication failed. Please try again.',
          success: false
        };
      }
    }

    return {
      output: '❌ Invalid password. Access denied.',
      success: false
    };
  }

  private async handleExit(context: CommandContext): Promise<CommandResult> {
    if (context.isAdminMode) {
      try {
        await apiRequest('POST', '/api/admin/logout');
        return {
          output: '✅ Exited admin mode.',
          success: true
        };
      } catch (error) {
        return {
          output: '✅ Exited admin mode.',
          success: true
        };
      }
    }

    return {
      output: 'Nothing to exit.',
      success: false
    };
  }

  // Admin command handlers
  private async handleAdd(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        output: `🛠️  Add Command Usage:
        
add project <title> "<description>" <tech1,tech2,tech3> [github_url] [demo_url]
add skill <category> <name> <proficiency_0-100> <years_experience>
add social <platform> <username> <url> "<display_name>"
add ascii <name> "<content>" [description]

Examples:
  add project "My App" "A cool web app" "React,Node.js,MongoDB" "https://github.com/user/repo"
  add skill "Frontend" "React" 90 3
  add social "github" "username" "https://github.com/username" "GitHub Profile"`,
        success: false
      };
    }

    const type = args[0];
    try {
      switch (type) {
        case 'project':
          return await this.addProject(args.slice(1));
        case 'skill':
          return await this.addSkill(args.slice(1));
        case 'social':
          return await this.addSocial(args.slice(1));
        case 'ascii':
          return await this.addAsciiArt(args.slice(1));
        default:
          return {
            output: `❌ Unknown type: ${type}. Use 'add' without args to see usage.`,
            success: false
          };
      }
    } catch (error) {
      return {
        output: `❌ Error adding ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private async addProject(args: string[]): Promise<CommandResult> {
    if (args.length < 3) {
      return {
        output: '❌ Usage: add project <title> "<description>" <tech1,tech2,tech3> [github_url] [demo_url]',
        success: false
      };
    }

    const [title, description, techStackStr, github, liveDemo] = args;
    const techStack = techStackStr.split(',').map(tech => tech.trim());
    
    const projectData = {
      title,
      description: description.replace(/"/g, ''),
      techStack,
      github: github || '',
      liveDemo: liveDemo || '',
      asciiArt: this.generateProjectAscii(title),
      status: 'development' as const,
      featured: false
    };

    try {
      const response = await apiRequest('POST', '/api/projects', projectData);
      const newProject = await response.json();
      
      let output = 'Creating project...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += `✅ Project "${title}" created successfully!\n`;
      output += `📝 Description: ${description.replace(/"/g, '')}\n`;
      output += `🛠️  Tech Stack: ${techStack.join(', ')}\n`;
      if (github) output += `🔗 GitHub: ${github}\n`;
      if (liveDemo) output += `🌐 Demo: ${liveDemo}\n`;
      
      return {
        output,
        success: true,
        loading: {
          message: 'Creating project...',
          progress: 100,
          duration: 2000
        }
      };
    } catch (error) {
      return {
        output: `❌ Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private async addSkill(args: string[]): Promise<CommandResult> {
    if (args.length < 4) {
      return {
        output: '❌ Usage: add skill <category> <name> <proficiency_0-100> <years_experience>',
        success: false
      };
    }

    const [category, name, proficiencyStr, yearsStr] = args;
    const proficiency = parseInt(proficiencyStr);
    const yearsOfExperience = parseInt(yearsStr);

    if (isNaN(proficiency) || proficiency < 0 || proficiency > 100) {
      return {
        output: '❌ Proficiency must be a number between 0 and 100',
        success: false
      };
    }

    if (isNaN(yearsOfExperience) || yearsOfExperience < 0) {
      return {
        output: '❌ Years of experience must be a positive number',
        success: false
      };
    }

    const skillData = {
      category,
      name,
      proficiency,
      yearsOfExperience
    };

    try {
      const response = await apiRequest('POST', '/api/skills', skillData);
      const newSkill = await response.json();
      
      const progressBar = '█'.repeat(Math.floor(proficiency / 2)) + '░'.repeat(50 - Math.floor(proficiency / 2));
      
      let output = 'Adding skill...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += `✅ Skill "${name}" added to ${category} category!\n`;
      output += `📊 Proficiency: [${progressBar}] ${proficiency}%\n`;
      output += `⏰ Experience: ${yearsOfExperience} years\n`;
      
      return {
        output,
        success: true,
        loading: {
          message: 'Adding skill...',
          progress: 100,
          duration: 1500
        }
      };
    } catch (error) {
      return {
        output: `❌ Failed to add skill: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private async addSocial(args: string[]): Promise<CommandResult> {
    if (args.length < 4) {
      return {
        output: '❌ Usage: add social <platform> <username> <url> "<display_name>"',
        success: false
      };
    }

    const [platform, username, url, displayName] = args;
    
    // Validate platform
    const validPlatforms = ['github', 'linkedin', 'twitter', 'instagram', 'gmail', 'email', 'youtube', 'portfolio'];
    if (!validPlatforms.includes(platform.toLowerCase())) {
      return {
        output: `❌ Invalid platform. Valid platforms are: ${validPlatforms.join(', ')}`,
        success: false
      };
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return {
        output: '❌ Invalid URL format. Please provide a valid URL including http:// or https://',
        success: false
      };
    }
    
    const socialData = {
      platform: platform.toLowerCase(),
      username,
      url,
      displayName: displayName.replace(/"/g, ''),
      id: `social_${Date.now()}` // Generate a unique ID
    };

    try {
      const response = await apiRequest('POST', '/api/social', socialData);
      const newLink = await response.json();
      
      let output = 'Adding social link...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += `✅ Social link for ${platform} added successfully!\n`;
      output += `👤 Username: ${username}\n`;
      output += `🔗 URL: ${url}\n`;
      output += `📛 Display Name: ${displayName.replace(/"/g, '')}\n`;
      
      return {
        output,
        success: true,
        loading: {
          message: 'Adding social link...',
          progress: 100,
          duration: 1500
        }
      };
    } catch (error) {
      return {
        output: `❌ Failed to add social link: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private async addAsciiArt(args: string[]): Promise<CommandResult> {
    if (args.length < 2) {
      return {
        output: '❌ Usage: add ascii <name> "<content>" [description]',
        success: false
      };
    }

    const [name, content, description] = args;
    
    const asciiData = {
      name,
      content: content.replace(/"/g, ''),
      description: description || ''
    };

    try {
      const response = await apiRequest('POST', '/api/ascii-art', asciiData);
      const newArt = await response.json();
      
      let output = 'Creating ASCII art...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += `✅ ASCII art "${name}" created successfully!\n\n`;
      output += 'Preview:\n';
      output += content.replace(/"/g, '') + '\n';
      
      return {
        output,
        success: true,
        loading: {
          message: 'Creating ASCII art...',
          progress: 100,
          duration: 1500
        }
      };
    } catch (error) {
      return {
        output: `❌ Failed to create ASCII art: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private generateProjectAscii(title: string): string {
    const width = 60;
    const border = '═'.repeat(width - 2);
    const paddedTitle = title.toUpperCase().padStart((width + title.length) / 2).padEnd(width - 2);
    
    return `╔${border}╗\n║${paddedTitle}║\n╚${border}╝`;
  }

  private async handleEdit(args: string[]): Promise<CommandResult> {
    if (args.length < 2) {
      return {
        output: `🛠️  Edit Command Usage:

edit project <id> <field> <value>
edit skill <id> <field> <value>
edit social <id> <field> <value>
edit bio "<new_content>"
edit stats <field> <value>

Examples:
  edit project proj123 title "New Project Name"
  edit skill skill456 proficiency 95
  edit bio "Updated bio content with new information"
  edit stats stars 150`,
        success: false
      };
    }

    const [type, ...rest] = args;
    
    try {
      switch (type) {
        case 'bio':
          return await this.editBio(rest);
        case 'stats':
          return await this.editStats(rest);
        case 'project':
        case 'skill':
        case 'social':
          return {
            output: `🔧 Direct editing of ${type} requires ID lookup. Use 'view ${type}s' first to get IDs.`,
            success: false
          };
        default:
          return {
            output: `❌ Unknown edit type: ${type}`,
            success: false
          };
      }
    } catch (error) {
      return {
        output: `❌ Error editing ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private async editBio(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        output: '❌ Usage: edit bio "<new_content>"',
        success: false
      };
    }

    const newContent = args.join(' ').replace(/"/g, '');
    
    try {
      const response = await apiRequest('PUT', '/api/bio', { content: newContent });
      const updatedBio = await response.json();
      
      let output = 'Updating bio...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += '✅ Bio updated successfully!\n\n';
      output += 'New content preview:\n';
      output += newContent.substring(0, 200) + (newContent.length > 200 ? '...' : '');
      
      return {
        output,
        success: true,
        loading: {
          message: 'Updating bio...',
          progress: 100,
          duration: 1500
        }
      };
    } catch (error) {
      return {
        output: `❌ Failed to update bio: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private async editStats(args: string[]): Promise<CommandResult> {
    if (args.length < 2) {
      return {
        output: '❌ Usage: edit stats <field> <value>\nFields: stars, commits, repos, followers, pullRequests, issues',
        success: false
      };
    }

    const [field, valueStr] = args;
    const value = parseInt(valueStr);
    
    if (isNaN(value) || value < 0) {
      return {
        output: '❌ Value must be a positive number',
        success: false
      };
    }

    const validFields = ['stars', 'commits', 'repos', 'followers', 'pullRequests', 'issues'];
    if (!validFields.includes(field)) {
      return {
        output: `❌ Invalid field: ${field}. Valid fields: ${validFields.join(', ')}`,
        success: false
      };
    }

    try {
      // First get current stats
      let currentStats = {};
      try {
        const currentResponse = await apiRequest('GET', '/api/github-stats');
        currentStats = await currentResponse.json() || {};
      } catch (e) {
        // If no stats exist, start with defaults
        currentStats = {
          stars: 0, commits: 0, repos: 0, followers: 0, pullRequests: 0, issues: 0
        };
      }

      const updatedStats = { ...currentStats, [field]: value };
      const response = await apiRequest('PUT', '/api/github-stats', updatedStats);
      const newStats = await response.json();
      
      let output = 'Updating GitHub stats...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += `✅ GitHub stats updated successfully!\n`;
      output += `📊 ${field}: ${value}\n\n`;
      output += 'Current stats:\n';
      output += `⭐ Stars: ${newStats.stars}        🔧 Commits: ${newStats.commits}\n`;
      output += `📂 Repos: ${newStats.repos}       👥 Followers: ${newStats.followers}\n`;
      output += `🧪 PRs: ${newStats.pullRequests}    🐛 Issues: ${newStats.issues}\n`;
      
      return {
        output,
        success: true,
        loading: {
          message: 'Updating GitHub stats...',
          progress: 100,
          duration: 1500
        }
      };
    } catch (error) {
      return {
        output: `❌ Failed to update stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private async handleDelete(args: string[]): Promise<CommandResult> {
    if (args.length < 2) {
      return {
        output: `🗑️  Delete Command Usage:

delete project <id>
delete skill <id>  
delete social <id>
delete message <id>
delete ascii <id>

⚠️  Warning: This action cannot be undone!

Use 'view messages' or 'projects' to find IDs first.`,
        success: false
      };
    }

    const [type, id] = args;
    
    try {
      switch (type) {
        case 'project':
          return await this.deleteItem('/api/projects', id, 'project');
        case 'skill':
          return await this.deleteItem('/api/skills', id, 'skill');
        case 'social':
          return await this.deleteItem('/api/social', id, 'social link');
        case 'message':
          return await this.deleteItem('/api/messages', id, 'message');
        case 'ascii':
          return await this.deleteItem('/api/ascii-art', id, 'ASCII art');
        default:
          return {
            output: `❌ Unknown delete type: ${type}`,
            success: false
          };
      }
    } catch (error) {
      return {
        output: `❌ Error deleting ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private async deleteItem(endpoint: string, id: string, itemType: string): Promise<CommandResult> {
    try {
      await apiRequest('DELETE', `${endpoint}/${id}`);
      
      let output = `Deleting ${itemType}...\n`;
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += `✅ ${itemType} deleted successfully!\n`;
      output += `🗑️  Item ID: ${id}\n`;
      
      return {
        output,
        success: true,
        loading: {
          message: `Deleting ${itemType}...`,
          progress: 100,
          duration: 1000
        }
      };
    } catch (error) {
      return {
        output: `❌ Failed to delete ${itemType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private async handleUpdate(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        output: `🔄 Update Command Usage:

update bio "<new_content>"
update stats <field> <value>
update social <platform> <field> <value>
update project <id> <field> <value>

This is an alias for the 'edit' command.
Use 'edit' for the same functionality.`,
        success: false
      };
    }

    // Redirect to edit command
    return this.handleEdit(args);
  }

  private async handleView(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        output: `👁️  View Command Usage:

view messages       → List all contact messages
view projects      → List all projects with IDs
view skills        → List all skills with IDs  
view social        → List all social links with IDs
view ascii         → List all ASCII art with IDs
view stats         → Show current GitHub statistics

Examples:
  view messages
  view projects`,
        success: false
      };
    }

    const type = args[0];
    
    try {
      switch (type) {
        case 'messages':
          return await this.viewMessages();
        case 'projects':
          return await this.viewProjects();
        case 'skills':
          return await this.viewSkills();
        case 'social':
          return await this.viewSocial();
        case 'ascii':
          return await this.viewAsciiArt();
        case 'stats':
          return await this.viewStats();
        default:
          return {
            output: `❌ Unknown view type: ${type}. Use 'view' without args to see usage.`,
            success: false
          };
      }
    } catch (error) {
      return {
        output: `❌ Error viewing ${type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false
      };
    }
  }

  private async viewMessages(): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/messages');
      const messages = await response.json();
      
      if (!messages || messages.length === 0) {
        return {
          output: '📭 No messages found.',
          success: true
        };
      }

      let output = 'Loading messages...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += `📬 Contact Messages (${messages.length} total):\n\n`;
      
      messages.forEach((message: any, index: number) => {
        const status = message.read ? '✅' : '📩';
        const date = new Date(message.timestamp).toLocaleDateString();
        output += `${status} [${message.id}] ${message.name} <${message.email}>\n`;
        output += `    Date: ${date}\n`;
        output += `    Message: ${message.message.substring(0, 100)}${message.message.length > 100 ? '...' : ''}\n\n`;
      });

      output += `\nUse 'delete message <id>' to remove messages.`;

      return {
        output,
        success: true,
        loading: {
          message: 'Loading messages...',
          progress: 100,
          duration: 1000
        }
      };
    } catch (error) {
      return {
        output: '❌ Failed to load messages. Please try again later.',
        success: false
      };
    }
  }

  private async viewProjects(): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/projects');
      const projects = await response.json();
      
      if (!projects || projects.length === 0) {
        return {
          output: '📂 No projects found. Use "add project" to create your first project.',
          success: true
        };
      }

      let output = 'Loading projects...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += `📂 Projects Database (${projects.length} total):\n\n`;
      
      projects.forEach((project: any) => {
        output += `🔹 [${project.id}] ${project.title}\n`;
        output += `   Status: ${project.status} | Tech: ${project.techStack.slice(0, 3).join(', ')}\n`;
        output += `   Description: ${project.description.substring(0, 80)}...\n\n`;
      });

      return {
        output,
        success: true,
        loading: {
          message: 'Loading projects...',
          progress: 100,
          duration: 1500
        }
      };
    } catch (error) {
      return {
        output: '❌ Failed to load projects. Please try again later.',
        success: false
      };
    }
  }

  private async viewSkills(): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/skills');
      const skillsByCategory = await response.json();
      
      if (!skillsByCategory || Object.keys(skillsByCategory).length === 0) {
        return {
          output: '🛠️  No skills found. Use "add skill" to add your technical skills.',
          success: true
        };
      }

      let output = 'Loading skills database...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += '🛠️  Skills Database:\n\n';
      
      Object.entries(skillsByCategory).forEach(([category, skills]) => {
        output += `📋 ${category}:\n`;
        (skills as any[]).forEach(skill => {
          const progressBar = '█'.repeat(Math.floor(skill.proficiency / 2)) + '░'.repeat(50 - Math.floor(skill.proficiency / 2));
          output += `   [${skill.id}] ${skill.name} - ${skill.proficiency}% (${skill.yearsOfExperience}y)\n`;
          output += `   [${progressBar}]\n`;
        });
        output += '\n';
      });

      return {
        output,
        success: true,
        loading: {
          message: 'Loading skills database...',
          progress: 100,
          duration: 1500
        }
      };
    } catch (error) {
      return {
        output: '❌ Failed to load skills. Please try again later.',
        success: false
      };
    }
  }

  private async viewSocial(): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/social');
      const links = await response.json();
      
      if (!links || !Array.isArray(links) || links.length === 0) {
        return {
          output: '🔗 No social links found. Use "add social" to add your social media profiles.',
          success: true
        };
      }

      let output = 'Loading social links...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += `🔗 Social Links (${links.length} total):\n\n`;
      
      links.forEach((link: any) => {
        const icon = this.getSocialIcon(link.platform);
        output += `${icon} [${link.id}] ${link.displayName}\n`;
        output += `   Platform: ${link.platform} | Username: ${link.username}\n`;
        output += `   URL: ${link.url}\n\n`;
      });

      return {
        output,
        success: true,
        loading: {
          message: 'Loading social links...',
          progress: 100,
          duration: 1000
        }
      };
    } catch (error) {
      return {
        output: '❌ Failed to load social links. Please try again later.',
        success: false
      };
    }
  }

  private async viewAsciiArt(): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/ascii-art');
      const artworks = await response.json();
      
      if (!artworks || artworks.length === 0) {
        return {
          output: '🎨 No ASCII art found. Use "add ascii" to create custom ASCII art.',
          success: true
        };
      }

      let output = 'Loading ASCII art gallery...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += `🎨 ASCII Art Gallery (${artworks.length} pieces):\n\n`;
      
      artworks.forEach((art: any) => {
        output += `🖼️  [${art.id}] ${art.name}\n`;
        if (art.description) output += `   Description: ${art.description}\n`;
        output += `   Preview: ${art.content.substring(0, 50)}...\n\n`;
      });

      return {
        output,
        success: true,
        loading: {
          message: 'Loading ASCII art gallery...',
          progress: 100,
          duration: 1500
        }
      };
    } catch (error) {
      return {
        output: '❌ Failed to load ASCII art. Please try again later.',
        success: false
      };
    }
  }

  private async viewStats(): Promise<CommandResult> {
    try {
      const response = await apiRequest('GET', '/api/github-stats');
      const stats = await response.json();
      
      const currentStats = stats || {
        stars: 0, commits: 0, repos: 0, followers: 0, pullRequests: 0, issues: 0
      };

      let output = 'Loading GitHub statistics...\n';
      output += '[████████████████████████████████████████████████████] 100%\n\n';
      output += '📊 Current GitHub Statistics:\n\n';
      output += `⭐ Total Stars: ${currentStats.stars}\n`;
      output += `🔧 Total Commits: ${currentStats.commits}\n`;
      output += `📂 Public Repositories: ${currentStats.repos}\n`;
      output += `👥 Followers: ${currentStats.followers}\n`;
      output += `🧪 Pull Requests: ${currentStats.pullRequests}\n`;
      output += `🐛 Issues Opened: ${currentStats.issues}\n\n`;
      output += 'Use "edit stats <field> <value>" to update these statistics.';

      return {
        output,
        success: true,
        loading: {
          message: 'Loading GitHub statistics...',
          progress: 100,
          duration: 1000
        }
      };
    } catch (error) {
      return {
        output: '❌ Failed to load GitHub stats. Please try again later.',
        success: false
      };
    }
  }

  private getSocialIcon(platform: string): string {
    const icons: Record<string, string> = {
      'github': '🔗',
      'linkedin': '🔗', 
      'twitter': '🐦',
      'instagram': '📸',
      'gmail': '📧',
      'email': '📧',
      'youtube': '📹',
      'portfolio': '🌐'
    };
    return icons[platform.toLowerCase()] || '🔗';
  }

  // Linux-like command implementations
  private handleEcho(args: string[]): CommandResult {
    const text = args.join(' ');
    return {
      output: text || '',
      success: true
    };
  }

  private async handlePing(args: string[]): Promise<CommandResult> {
    const target = args[0] || 'localhost';
    
    let output = `PING ${target}:\n`;
    
    // Simulate ping with realistic timing
    for (let i = 1; i <= 4; i++) {
      const time = Math.floor(Math.random() * 50) + 10;
      output += `64 bytes from ${target}: icmp_seq=${i} time=${time}ms\n`;
    }
    
    output += `\n--- ${target} ping statistics ---\n`;
    output += `4 packets transmitted, 4 received, 0% packet loss`;

    return {
      output,
      success: true,
      loading: {
        message: `Pinging ${target}...`,
        progress: 100,
        duration: 2000
      }
    };
  }

  private async handleCat(args: string[]): Promise<CommandResult> {
    const filename = args[0];
    
    if (!filename) {
      return {
        output: 'cat: missing file operand\nUsage: cat <filename>',
        success: false
      };
    }

    // Mock file system with portfolio data
    const files: Record<string, string> = {
      'about.txt': `Christopher Joshy - Full Stack Developer
==================================================
Passionate developer with 3+ years of experience
Specializes in React, Node.js, Python, and AI/ML
Always learning and building amazing things!`,
      'skills.txt': `Technical Skills:
• Frontend: React, TypeScript, Next.js
• Backend: Node.js, Python, Express  
• Database: PostgreSQL, MongoDB, Firebase
• Cloud: AWS, Google Cloud, Vercel
• AI/ML: TensorFlow, OpenAI API, Langchain`,
      'contact.txt': `Contact Information:
📧 Email: christopherjoshy4@gmail.com
🔗 LinkedIn: linkedin.com/in/christopher-joshy-272a77290/
🐙 GitHub: github.com/christopherjoshy`
    };

    const content = files[filename];
    if (!content) {
      return {
        output: `cat: ${filename}: No such file or directory`,
        success: false
      };
    }

    return {
      output: content,
      success: true
    };
  }

  private handleWhoami(): CommandResult {
    return {
      output: `👤 Current User\n│\n│ Christopher Joshy\n│ Full Stack Developer\n│`,
      success: true
    };
  }

  private handlePwd(): CommandResult {
    return {
      output: `📂 Current Directory\n│\n│ ${process.cwd()}\n│`,
      success: true
    };
  }

  private handleDate(): CommandResult {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    };
    
    return {
      output: `📅 Current Time\n│\n│ ${now.toLocaleString('en-US', options)}\n│`,
      success: true
    };
  }

  private handleUptime(): CommandResult {
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / (24 * 60 * 60));
    const hours = Math.floor((uptimeSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptimeSeconds % (60 * 60)) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    return {
      output: `⏱️  System Uptime\n│\n│ ${days}d ${hours}h ${minutes}m ${seconds}s\n│`,
      success: true
    };
  }

  private handleLs(): CommandResult {
    return {
      output: `📁 Directory Contents\n│\n` +
        `│ Available Commands\n│ ├─ help, about, skills\n│ ├─ projects, contact, resume\n│ ├─ social, fastfetch\n│ └─ clear, exit\n│`,
      success: true
    };
  }

  private commandNotFound(command: string): CommandResult {
    return {
      output: `Command not found: ${command}. Type 'help' for available commands.`,
      success: false
    };
  }
}

export const terminalCommands = new TerminalCommands();
