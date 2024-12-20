# 🎨 Collaborative Drawing Board

![Project Banner](/assets/pics/landing.png)

## Table of Contents

- [Introduction](#introduction)
- [Motivation](#motivation)
- [Features](#features)
- [Technical Stack](#technical-stack)
- [Frameworks Used](#frameworks-used)
- [Demo](#demo)
- [Getting Started](#getting-started)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Contact](#contact)


---

## Introduction

Welcome to the **Collaborative Drawing Board** project! This web application enables multiple users to collaborate in real-time on a shared drawing canvas. Whether you're brainstorming ideas, teaching, or just having fun, our platform provides the tools you need to create and share your visions seamlessly.

---

## Motivation

In an increasingly digital world, collaboration tools have become essential for teams and individuals alike. Traditional drawing tools often lack real-time collaboration features, making it difficult for users to work together efficiently. Our goal was to bridge this gap by developing a user-friendly, feature-rich collaborative drawing board that empowers creativity and teamwork.

---

## Features

- **Real-Time Collaboration**: Multiple users can draw simultaneously on the same canvas.
- **Access Control**: Secure access to boards with options to create private or public sessions.
- **Basic Drawing Tools**: Includes pen, eraser, shapes, and color selection.
- **Text Insertion**: Add and edit text directly on the canvas.
- **PDF Upload & Resize**: Upload PDFs to the canvas and adjust their size as needed.
- **Chatbot Analysis**: Utilize AI-powered chatbot to analyze and provide insights on selected areas of the canvas.
- **Dashboard**: Intuitive dashboard to create or join existing boards effortlessly.

---

## Technical Stack

- **Frontend**: React.js, Redux, HTML5, CSS3
- **Backend**: Node.js, Express.js
- **Database**: Firestore Realtime DB/MongoDB
- **Real-Time Communication**: Socket.io
- **Authentication**: Firebase Authentication
- **AI Integration**: OpenAI GPT for chatbot analysis

---

## Frameworks Used

- **React.js**: For building a dynamic and responsive user interface.
- **Redux**: State management to handle complex application states.
- **Node.js & Express.js**: Server-side development and API handling.
- **Socket.io**: Enabling real-time, bi-directional communication between clients and server.
- **FirestoreDB**: EFficient NoSQL database for storing real time data.
- **OpenAI GPT**: Integrating advanced AI for chatbot analysis features.

---

## Demo

Here are some GIFs demonstrating the key features of the Collaborative Drawing Board:

### 1. Dashboard Component

Users can create a new board or join an existing one seamlessly.

![Dashboard](/assets/gif/dashboard.gif)

### 2. Basic Drawing

Experience smooth and responsive drawing capabilities.

![Basic Drawing](/assets/gif/brushTool.gif)

### 3. Text Insertion

Add and edit text directly on the canvas.

![Text Feature](/assets/gif/textTool.gif)

### 4. PDF Upload

Upload PDF documents to integrate into your drawings.

![PDF Upload](/assets/gif/pdfUpload.gif)

### 5. PDF Resize

Easily resize uploaded PDFs to fit your needs.

![PDF Resize](path/to/pdfResize.gif)

### 6. Chatbot Analysis

Utilize AI to analyze specific areas of your canvas.

![Chatbot Analysis](/assets/gif/chatbot_analysis.gif)

---

## Getting Started

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/collaborative-drawing-board.git
   cd collaborative-drawing-board
   ```

### Install Frontend Dependencies and Build Static React Components

```bash

cd ../frontend
npm install
npm run build
```

### Start the Backend Server

```bash
node server.js
```

The application will be available locally at http://localhost:3000 or http://localhost:5000 depending on your build.

## Deployment
- We have deployed our Collaborative Drawing Board globally, and it is accessible online:

https://drawing-board-production.up.railway.app



## Contributing
We welcome contributions from the community! To contribute:

- Fork the Repository
- Create a Feature Branch
```bash
git checkout -b feature/YourFeature
```

- Commit Your Changes
```bash
git commit -m "Add YourFeature"
```

- Push to the Branch
```bash
git push origin feature/YourFeature
```
- Open a Pull Request and please ensure your code adheres to our Code of Conduct and Contribution Guidelines.



## Contact
For any questions or feedback, feel free to reach out:

Email: dalerkim4@gmail.com