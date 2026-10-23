# CiCaWa - Circular Waste Management Platform 🌱♻️

[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-005791?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=flat&logo=python)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-success.svg)](#)

**Team: Neural Nomads** | **Hackathon Project**

A comprehensive digital platform that revolutionizes waste management by creating a circular economy ecosystem connecting citizens, workers, NGOs, and businesses.

## 📊 Quick Stats

| Metric | Value |
|--------|-------|
| **Tech Stack** | Next.js 14 + FastAPI |
| **Database** | SQLite + SQLAlchemy |
| **AI Integration** | Google Gemini API |
| **Authentication** | JWT-based |
| **Real-time** | Socket.IO |
| **Lines of Code** | ~5000+ |

---

## 🏆 Team Members

- **Karthik Krishnan** - Full Stack Developer
- **Deon George** - Backend Developer & AI Integration  
- **Christopher Joshy** - Full Stack Developer & UI/UX (Leader)
- **Amal Kuriyan** - Database Engineer & System Architecture

## 🌟 Project Overview

CiCaWa transforms traditional waste management into a smart, sustainable, and profitable ecosystem. Our platform leverages AI-powered waste classification, real-time tracking, and community engagement to create value from waste while promoting environmental sustainability.

### 🎯 Core Mission
To build a comprehensive waste management solution that:
- **Monetizes waste** through intelligent classification and marketplace
- **Connects communities** with workers, NGOs, and recycling centers
- **Provides expert guidance** through AI-powered waste advice
- **Promotes sustainability** through education and gamification

## 🏗️ System Architecture

### 🔧 Technology Stack

#### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS with custom emerald theme
- **Icons**: Lucide React
- **State Management**: React Hooks
- **Form Handling**: React Hook Form
- **Authentication**: JWT-based with localStorage

#### Backend
- **Framework**: FastAPI (Python)
- **Database**: SQLite with SQLAlchemy ORM
- **Authentication**: JWT tokens with bcrypt password hashing
- **AI Integration**: Google Gemini API for waste classification and advice
- **Real-time Communication**: Socket.IO for live updates
- **File Upload**: Multipart form handling for images

#### Database Schema
```sql
-- Users table with role-based access
Users: id, email, password, name, phone, address, role, coordinates

-- Waste management
WasteRequests: user_id, waste_type, quantity, description, location, status, pricing
WastePrices: waste_type, price_per_kg, updated_at

-- Marketplace for recycled goods
MarketplaceListings: seller_id, title, description, price, category, status

-- Donation system
Donations: user_id, donation_type, description, location, ngo_assignment

-- Real-time messaging
ChatMessages: sender_id, receiver_id, message, context, timestamp
```

## 🚀 Key Features

### 🤖 AI-Powered Waste Classification
- **Gemini API Integration**: Intelligent waste type identification
- **Image Recognition**: Upload photos for accurate classification
- **Price Estimation**: Real-time market pricing for different waste types
- **Confidence Scoring**: Reliability metrics for AI predictions

### 💬 Smart Waste Advisor Chatbot
Our AI chatbot provides personalized advice for any waste item:

**Example Interactions:**
```
User: "I have old plastic bottles"
Bot: "Plastic bottles can be:
• SELL: Clean PET bottles have market value ($2/kg)
• HARITHA KARMA: For general recycling pickup
• DIY: Create planters or storage containers
• Environmental tip: Always remove labels and caps"

User: "What about old clothes?"
Bot: "Old clothes options:
• NGO DONATION: Good condition clothes help families
• HARITHA KARMA: Worn textiles for recycling
• DIY: Cut into cleaning rags or craft materials
• Special: Donate winter clothes during cold season"
```


### 👥 Role-Based Access System

#### 🏠 **Citizens/Users**
- Schedule waste pickups with AI-powered pricing
- Sell recyclables through integrated marketplace
- Donate items to verified NGOs
- Get personalized waste management advice
- Track environmental impact and earnings

#### 🚛 **Haritha Karma Workers**
- Receive optimized pickup routes
- Real-time job assignments based on location
- Digital payment integration
- Performance tracking and ratings

#### 🏢 **NGOs**
- Manage donation requests by category
- Connect with donors in their area
- Track donation impact and statistics
- Specialized matching (food, clothes, education)

#### 👔 **Admin Users**
- User role management system
- Waste pricing control
- Platform analytics and reporting
- System configuration and monitoring

### 🛒 Circular Economy Marketplace
- **Buy/Sell Interface**: Trade recycled materials and upcycled goods
- **Category Management**: Organized by material type and condition
- **Secure Transactions**: Integrated payment and rating system
- **Business Integration**: Connect with recycling companies

### 📍 Location-Based Services
- **GPS Integration**: Automatic location detection for pickups
- **Route Optimization**: Efficient worker assignment algorithm
- **Service Area Management**: Location-based service availability
- **Real-time Tracking**: Live updates on pickup status

## 📸 Screenshots

> *Screenshots coming soon!*
> 
> Show off your implementation? We welcome screenshots! Submit a PR to add them here.

| Feature | Preview |
|---------|---------|
| Dashboard | *(Add screenshot)* |
| AI Classifier | *(Add screenshot)* |
| Marketplace | *(Add screenshot)* |
| Mobile View | *(Add screenshot)* |

---

## 🔌 API Documentation

### 🔑 Authentication Endpoints
```javascript
POST /auth/register - User registration
POST /auth/login - User authentication  
GET /auth/me - Get current user profile
```

### 🗑️ Waste Management APIs
```javascript
GET /waste-types - Available waste categories
GET /waste-prices - Current market prices
POST /waste-requests - Schedule pickup
GET /waste-requests - User's pickup history
```

### 🏪 Marketplace APIs
```javascript
GET /marketplace - Browse listings
POST /marketplace - Create new listing
PUT /marketplace/{id}/sold - Mark as sold
```

### 🤝 NGO & Donation APIs
```javascript
GET /ngos - List verified NGOs
POST /donations - Create donation request
GET /donations - Donation history
```

### 🤖 AI Services
```javascript
POST /ai/chat - Waste advice chatbot
POST /ai/classify - Waste classification with images
```

### 👑 Admin APIs
```javascript
GET /admin/users - User management
PUT /admin/users/role - Update user roles
PUT /admin/waste-prices - Price management
```

## 🎨 User Interface Design

### 🌿 Design System
- **Primary Color**: Emerald Green (#059669) - Represents sustainability
- **Secondary Colors**: Complementary greens and earth tones
- **Typography**: Clean, accessible fonts with proper contrast
- **Components**: Consistent card-based layout with subtle shadows
- **Responsive**: Mobile-first design with adaptive layouts

### 📱 Mobile Experience
- **Progressive Web App**: Installable on mobile devices
- **Touch-Optimized**: Large buttons and intuitive gestures
- **Offline Capability**: Essential features work without internet
- **Push Notifications**: Real-time updates on pickups and messages

## 🔒 Security & Privacy

### 🛡️ Data Protection
- **Password Security**: Bcrypt hashing with salt
- **JWT Authentication**: Secure token-based sessions
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries with SQLAlchemy

### 🌐 CORS Configuration
```python
# Configured for development and production
allow_origins=["*"]  # Configurable per environment
allow_methods=["GET", "POST", "PUT", "DELETE"]
allow_headers=["*"]
allow_credentials=True
```

## 📊 Database Implementation

### 🏗️ Database Design
```python
# User Management
class User(Base):
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER)
    # ... location and profile data

# Waste Management
class WasteRequest(Base):
    user_id = Column(Integer, ForeignKey('users.id'))
    waste_type = Column(Enum(WasteType))
    quantity = Column(Float)
    status = Column(Enum(RequestStatus))
    estimated_price = Column(Float)
    # ... location and timing data
```

### 🔄 Data Relationships
- **One-to-Many**: Users → WasteRequests, MarketplaceListings
- **Many-to-Many**: Users ↔ ChatMessages
- **Hierarchical**: Admin → User role management

## 🚀 Installation & Setup

### 📋 Prerequisites
- **Node.js** 18+ and npm/yarn
- **Python** 3.8+ with pip
- **SQLite** (included with Python)
- **Gemini API Key** from Google AI Studio

### 🔧 Backend Setup
```bash
cd backend/

# Install dependencies
pip install -r requirements.txt

# Environment configuration
cp env.example .env
# Add your Gemini API key to .env:
# GEMINI_API_KEY=your_api_key_here

# Initialize database
python main.py
# Creates SQLite database with default admin user:
# Email: christopherjoshy4@gmail.com
# Password: password
```

### 🎨 Frontend Setup
```bash
cd frontend/

# Install dependencies
npm install

# Environment configuration
cp env.example .env.local
# Configure API endpoint:
# NEXT_PUBLIC_API_URL=http://localhost:8000

# Start development server
npm run dev
# Runs on http://localhost:3000
```

### 🌐 Production Deployment
```bash
# Backend (FastAPI)
uvicorn main:app --host 0.0.0.0 --port 8000

# Frontend (Next.js)
npm run build
npm start
```

## 🧪 Testing & Development

### 🔍 API Testing
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health
- **CORS Test**: http://localhost:8000/cors-test

### 🐛 Common Issues & Solutions

#### CORS Errors
```javascript
// Ensure backend CORS is configured
// Check if backend server is running on correct port
// Verify API_URL in frontend environment
```

#### Database Issues
```python
# Reset database
rm cicawa.db
python main.py  # Recreates with fresh data
```

#### Authentication Problems
```javascript
// Clear localStorage
localStorage.clear()
// Re-login with valid credentials
```

## 🌍 Environmental Impact

### 📈 Sustainability Metrics
- **Waste Diverted**: Track tonnage redirected from landfills
- **Carbon Footprint**: Calculate emissions saved through recycling
- **Community Engagement**: Measure user participation and education
- **Economic Value**: Monitor income generated for citizens and workers

### 🎯 Future Enhancements
- **IoT Integration**: Smart bins with fill-level sensors
- **Blockchain**: Transparent waste tracking and carbon credits
- **Machine Learning**: Improved waste classification and route optimization
- **Gamification**: Rewards and leaderboards for sustainable behavior

## 📞 Support & Contact

### 💬 Get Help
- **Technical Issues**: Check API documentation and error logs
- **Feature Requests**: Submit through GitHub issues
- **Community**: Join our sustainability forums

### 🤝 Contributing

We welcome contributions! Whether you're a developer, designer, or sustainability enthusiast, there are many ways to help:

#### 🛠️ How to Contribute

1. **Fork the Repository**
   ```bash
   git clone https://github.com/your-username/CiCaWa-HashITup.git
   cd CiCaWa-HashITup
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Follow existing code conventions
   - Add comments for complex logic
   - Test your changes thoroughly

4. **Commit & Push**
   ```bash
   git add .
   git commit -m "Add: your feature description"
   git push origin feature/your-feature-name
   ```

5. **Submit a Pull Request**
   - Describe your changes clearly
   - Link any related issues
   - Include screenshots for UI changes

#### 📋 Contribution Guidelines

- **Code Style**: Follow ESLint and Prettier
- **Comm configurationsits**: Use clear, descriptive commit messages
- **Testing**: Ensure no breaking changes before submitting
- **Documentation**: Update docs for any API changes

#### 🎯 Areas for Contribution

| Area | Description |
|------|-------------|
| 🎨 UI/UX | Improve designs, add new components |
| 🔧 Features | Add new functionality |
| 🐛 Bug Fixes | Fix issues and improve stability |
| 📚 Docs | Enhance documentation |
| 🧪 Testing | Add unit and integration tests |
| ⚡ Performance | Optimize slow code paths |

#### 💬 Getting Help

- Open an issue for bugs or feature requests
- Join discussions in the community forum
- Check existing issues before creating new ones

---

### 📞 Support & Contact

### 💬 Get Help
- **Technical Issues**: Check API documentation and error logs
- **Feature Requests**: Submit through GitHub issues
- **Community**: Join our sustainability forums

---
.
**Built with ❤️ by Neural Nomads**  
*Making waste management smarter, sustainable, and profitable for everyone.*

🌱 **Together, we're building a cleaner, greener future!** 🌍
