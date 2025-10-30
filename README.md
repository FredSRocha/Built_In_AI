# 🤖 AURA: Time Flowing With You...

To ensure daily productivity, it is ideal that tasks are completed as soon as possible; therefore, our WEB APPLICATION is ideal for short-term scheduling. Use Aura - Time that flows with you!

![Screenshot](https://ik.imagekit.io/fredsrocha/github/rp/built-in-ai-2025/screenshot.png?updatedAt=1761850495022)

## 💥 The Problem

The challenge is the disorganization and cognitive overload I face when dealing with multiple daily commitments. Today, traditional calendar applications require the user to manually enter every detail, which can be laborious and unintuitive.

## ✨ The Solution

A multimodal intelligent assistant for scheduling tasks via audio or post-it note (image) using the Prompt API and Gemini Nano in Firebase AI Logic to ensure a hybrid user experience, processing data locally or in the cloud.

## 🤔 How Does It Work?

On Chrome-compatible devices (On-device AI), processing uses the Prompt API and Gemini Nano on the user's device. On browsers or systems without built-in AI support compatible with Chrome (Cloud AI / Fallback), Firebase AI Logic performs processing through Cloud AI, offering the user a consistent experience across different environments.

## 🛡 Is It Safe To Use?

**Yes!!!** This **WEB APPLICATION** stores tasks locally via IndexedDB, and AI processing (Built-in or Cloud) is used only to ensure structured output of information via JSON for analysis and dynamic consumption in the user interface.

**AI CONFLICT RESOLUTION:** When AI identifies date/time conflicts in tasks, it acts autonomously and determines the best time without human intervention. Example: If the task: _"Take my cat to get vaccinated at 11 am"_ is added, but there is a scheduled business meeting, then this appointment is registered at a different time.

## 🎯 Architecture

![Architecture](https://ik.imagekit.io/fredsrocha/github/rp/built-in-ai-2025/architecture.png?updatedAt=1761855121550)

**Why Aura?**

- Fast, intuitive, and multimodal input (voice + image).
- Hybrid AI processing for flexibility and reliability.
- Conflict-free scheduling without manual intervention.
- Optimized for short-term productivity and daily task flow.

_Simplify your day. Focus on what matters._

## 🆓 License

This project is licensed under the **Apache-2.0** license. See the [LICENSE](LICENSE) file for more details.

## 🚀 Run this code

Create a project in Firebase AI Logic and add your web app's settings in a .env file.

```bash
VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_STORAGE_BUCKET=""
VITE_FIREBASE_MESSAGING_SENDER_ID=""
VITE_FIREBASE_APP_ID=""
```

```bash
npm install
```

```bash
npm run dev
```

Access: http://localhost:5173/ in your browser!

![Architecture](https://ik.imagekit.io/fredsrocha/github/rp/built-in-ai-2025/webpage.png?updatedAt=1761856649970)
