# CivicPulse

### A Civic Resilience and Disaster Assistance Platform

CivicPulse is a web-based platform designed to help communities access and share important information during emergencies and disaster situations. The platform brings together civic alerts, weather information, emergency resources, and community-oriented tools in one accessible interface.

The project focuses on improving access to timely information and supporting community preparedness, response, and resilience.

---

## 🌍 Overview

During disasters and local emergencies, people may need to quickly find reliable information about weather conditions, emergency resources, affected areas, and available assistance.

It aims to provide a centralized digital platform where users can access relevant information through a simple and accessible interface.

### Key objectives

- Improve access to emergency and civic information
- Support community awareness and preparedness
- Provide relevant weather and environmental information
- Help users locate useful emergency resources
- Present information in a clear and accessible format
- Create a foundation for future community-driven disaster response features

---

## ✨ Features

### 🚨 Emergency & Civic Information
Provides users with access to important civic and emergency-related information through a centralized dashboard.

### 🌦️ Weather Information
Integrates weather information to help users understand current environmental conditions that may be relevant during emergencies.

### 📍 Community-Focused Resources
Organizes useful information and resources that can support individuals and communities during disaster situations.

### 🖥️ Interactive Dashboard
Provides a responsive interface for viewing relevant information without requiring users to navigate through multiple separate services.

### 🤖 AI-Assisted Information
The project integrates Google's Gemini API for AI-powered functionality within the platform.

---

## 🛠️ Technology Stack

### Frontend

- React
- TypeScript
- Vite
- CSS

### AI & APIs

- Google Gemini API
- Weather API / external data services

### Development & Deployment

- GitHub
- Vercel
- Google AI Studio

---

## 📁 Project Structure

```text
CivicPulse/
│
├── src/
│   ├── components/       # Reusable UI components
│   ├── data/             # Application data
│   ├── services/         # API and service integrations
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── App.tsx           # Main application component
│   ├── main.tsx          # Application entry point
│   └── index.css         # Global styles
│
├── public/               # Static assets
├── .env.example          # Environment variable template
├── package.json          # Dependencies and scripts
├── vite.config.ts        # Vite configuration
└── README.md             # Project documentation
