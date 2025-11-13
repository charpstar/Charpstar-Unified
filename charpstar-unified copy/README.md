# 🚀 Charpstar Platform

<div align="center">

![Charpstar Platform](https://img.shields.io/badge/Platform-3D%20AR%20Production-blue?style=for-the-badge&logo=three.js)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database-green?style=for-the-badge&logo=supabase)

**A comprehensive 3D modeling and AR production platform for clients, modelers, and quality assurance teams**

[Live Demo](https://platform.charpstar.co) • [Documentation](#documentation) • [Features](#features) • [Getting Started](#getting-started)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [User Roles](#user-roles)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

The **Charpstar Platform** is a cutting-edge web application designed to streamline 3D model production workflows for e-commerce and AR applications. It connects clients, 3D modelers, and quality assurance teams in a unified ecosystem, enabling efficient project management, real-time collaboration, and high-quality 3D asset delivery.

### 🌟 Key Capabilities

- **3D Model Management**: Upload, organize, and manage 3D assets with support for GLB and CAD files
- **AR Scene Generation**: AI-powered background generation for product visualization
- **Real-time Collaboration**: Multi-user workflows with role-based permissions
- **Quality Assurance**: Comprehensive review and approval system
- **Analytics Dashboard**: Detailed insights and performance metrics
- **Production Pipeline**: End-to-end project management from upload to delivery

---

## ✨ Features

### 🎨 **3D Editor & Visualization**

- Interactive 3D model viewer with Three.js
- Real-time model manipulation and preview
- Material and lighting controls
- Export capabilities for multiple formats

### 🤖 **AI-Powered Scene Generation**

- Google Gemini integration for intelligent background generation
- Product-specific scene creation based on dimensions and context
- Photorealistic rendering with proper lighting and shadows
- Customizable scene parameters and styles

### 👥 **Multi-Role User Management**

- **Clients**: Upload products, manage projects, track progress
- **Modelers**: Receive assignments, upload 3D models, manage portfolio
- **QA Teams**: Review submissions, approve/reject models, provide feedback
- **Admins**: Full system control, user management, analytics

### 📊 **Advanced Analytics**

- BigQuery integration for comprehensive data analysis
- Real-time performance metrics and KPIs
- Conversion rate tracking and user engagement analytics
- Customizable reports and dashboards

### 🔄 **Production Pipeline**

- Automated assignment distribution
- Progress tracking and deadline management
- Bulk operations and batch processing
- Cost tracking and invoicing system

### 🎯 **Quality Assurance**

- Structured review workflows
- Comment and feedback system
- Approval/rejection tracking
- Performance metrics for QA teams

---

## 👥 User Roles

### 🏢 **Client**

- **Purpose**: Upload products and manage 3D model production projects
- **Capabilities**:
  - Upload product images and specifications
  - Create and manage production batches
  - Track project progress and deadlines
  - Review and approve completed models
  - Access analytics and performance data
  - Manage asset library and portfolio

### 🎨 **Modeler**

- **Purpose**: Create high-quality 3D models for client projects
- **Capabilities**:
  - View assigned projects and deadlines
  - Upload 3D models (GLB, CAD files)
  - Manage personal portfolio and showcase work
  - Track completion rates and performance
  - Access modeling guidelines and resources
  - Submit work for QA review

### 🔍 **QA (Quality Assurance)**

- **Purpose**: Review and approve 3D models before client delivery
- **Capabilities**:
  - Review submitted 3D models
  - Approve or request revisions
  - Provide detailed feedback to modelers
  - Track review statistics and performance
  - Manage quality standards and guidelines

### ⚙️ **Admin**

- **Purpose**: Manage the entire platform and user ecosystem
- **Capabilities**:
  - Full system administration
  - User management and role assignment
  - Project allocation and workflow management
  - Analytics and reporting oversight
  - System configuration and maintenance
  - Bug tracking and issue resolution

---

## 🛠 Tech Stack

### **Frontend**

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 5.0
- **Styling**: Tailwind CSS + shadcn/ui
- **3D Graphics**: Three.js + React Three Fiber
- **State Management**: SWR + React Query
- **UI Components**: Radix UI primitives

### **Backend**

- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **AI Integration**: Google Gemini API

### **Analytics & Monitoring**

- **Data Warehouse**: Google BigQuery
- **Analytics**: Vercel Analytics
- **Error Tracking**: Built-in error handling
- **Performance**: Real-time monitoring

### **Development Tools**

- **Package Manager**: npm
- **Linting**: ESLint
- **Type Checking**: TypeScript
- **Build Tool**: Next.js Turbopack
- **Version Control**: Git

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Google Cloud Platform account (for BigQuery)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/charpstar-unified.git
   cd charpstar-unified
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Database Setup**

   ```bash
   # Run Supabase migrations
   supabase db push
   ```

4. **Start Development Server**

   ```bash
   npm run dev
   ```

5. **Open Application**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
charpstar-unified/
├── app/                          # Next.js App Router
│   ├── (dashboard)/             # Dashboard pages
│   │   ├── admin/              # Admin-specific pages
│   │   ├── analytics/          # Analytics dashboard
│   │   ├── asset-library/      # Asset management
│   │   ├── faq/               # FAQ system
│   │   ├── production/        # Production pipeline
│   │   └── ...                # Other dashboard pages
│   ├── api/                   # API routes
│   │   ├── assets/           # Asset management APIs
│   │   ├── auth/             # Authentication APIs
│   │   ├── users/            # User management APIs
│   │   └── ...               # Other API endpoints
│   └── auth/                 # Authentication pages
├── components/                 # Reusable components
│   ├── 3d-editor/            # 3D editor components
│   ├── analytics/            # Analytics components
│   ├── dashboard/            # Dashboard widgets
│   ├── navigation/           # Navigation components
│   └── ui/                   # Base UI components
├── contexts/                  # React contexts
├── hooks/                     # Custom React hooks
├── lib/                      # Utility libraries
├── supabase/                 # Database migrations
├── types/                    # TypeScript type definitions
└── utils/                    # Utility functions
```

---

## 🙏 Acknowledgments

- **Three.js** for 3D graphics capabilities
- **Supabase** for backend infrastructure
- **Vercel** for deployment and hosting
- **shadcn/ui** for beautiful UI components
- **Google Gemini** for AI-powered features

---

<div align="center">

**Built with ❤️ by the Charpstar Team**

[Platform](https://platform.charpstar.co)

</div>
