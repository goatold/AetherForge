# AetherForge User Guide

Welcome to AetherForge, a single-topic learning platform powered by AI. This guide will walk you through the core concepts and workflows to help you master any subject.

## Introduction

AetherForge is designed to help you learn deeply by generating structured content, quizzes, and flashcards tailored to your chosen topic and difficulty level. It combines AI generation with proven learning techniques like active recall and spaced repetition.

## Getting Started

### 1. Sign In
Access the application and sign in. AetherForge uses passwordless authentication or simple email/password depending on the configuration.

### 2. Onboarding & Workspace Setup
Upon your first login, you will be guided through an onboarding flow:
-   **Topic**: Choose the specific subject you want to learn (e.g., "System Design", "Photosynthesis", "European History").
-   **Difficulty**: Select a level (Beginner, Intermediate, Advanced) to tailor the complexity of the AI-generated content.
-   **Goals**: Set specific learning objectives to guide the AI.

This creates your personal **Workspace**. All your progress, content, and history are scoped to this workspace.

## Connecting AI Providers

To generate content, AetherForge needs to connect to an AI provider. You have two options:

### Option 1: Official API (Recommended)
Connect your own AI provider account securely via OAuth. This provides the most reliable and fast generation experience.
1.  Navigate to **Settings** or the **AI Connection** page (`/ai-connect`).
2.  Click "Connect" next to your preferred provider (OpenAI, Anthropic, or Google).
3.  Follow the OAuth login flow to authorize AetherForge.
4.  Once connected, your access token is stored securely (encrypted) and refreshed automatically.

### Option 2: Browser Automation (Experimental)
If you do not have an API subscription, you can use the experimental browser automation mode.
1.  Ensure the server has `AI_BROWSER_AUTOMATION=1` enabled.
2.  Log in to the provider's web interface (e.g., ChatGPT) in a separate browser tab.
3.  In AetherForge, select the "Browser Automation" tab in AI settings.
4.  Select the provider and click "Mark Connected".
*Note: This mode relies on controlling a browser session and may be less reliable.*

## Core Learning Workflow

### 1. Learn (Concept Explorer)
-   Navigate to the **Learn** tab.
-   AetherForge generates a "Concept Graph" or tree based on your topic.
-   Click on any concept node to view its **Concept Detail** page.
-   **Details**: Read the summary, explanation, and AI-generated examples or case studies.

### 2. Practice (Quizzes)
-   Navigate to the **Quiz** tab.
-   Click "Generate Quiz" to create a new quiz based on your concepts.
-   **Attempt**: Take the quiz. Questions may include Multiple Choice, True/False, or Short Answer.
-   **Feedback**: After submission, receive instant AI feedback on your answers, including explanations for any mistakes.
-   **History**: Track your scores over time to see your improvement.

### 3. Reinforce (Flashcards)
-   Navigate to the **Flashcards** tab.
-   **Generation**: Flashcards are generated automatically from concepts and specifically from questions you missed in quizzes.
-   **Review**: Use the "Review" mode to practice. AetherForge uses a Spaced Repetition System (SRS) to schedule cards.
    -   Rate your recall (Again, Hard, Good, Easy).
    -   The system calculates the next optimal review time to maximize retention.

## Tracking Progress

### Learning Plan
-   Navigate to the **Plan** tab.
-   View your personalized **Learning Plan**, broken down into milestones.
-   Mark milestones as complete as you progress.
-   The timeline view shows your activity history across concepts, quizzes, and flashcards.

### Progress Dashboard
-   See high-level metrics on your mastery of the topic.
-   Visualize your quiz score trends and flashcard retention rates.

## Additional Features

### Resources & Notes
-   Navigate to the **Resources** tab.
-   Save external links, articles, or videos related to your topic.
-   Add personal notes and tags to organize your reference materials.

### Collaboration
-   Share your workspace with others (e.g., a study group or tutor).
-   **Roles**:
    -   **Viewer**: Read-only access.
    -   **Editor**: Can generate content, take quizzes (their progress is separate), and edit notes.
    -   **Owner**: Full administrative control.
-   Invite users via email from the Collaboration settings.

### Export
-   Generate a **Study Packet** for offline learning.
-   Select content to include: Concept summaries, Quiz booklets, Flashcard sheets.
-   Print directly from the browser or save as PDF.

## Troubleshooting

-   **Generation Failed**: If AI generation fails, check your connection in the `/ai-connect` page. Ensure your OAuth token is valid or your browser session is active.
-   **Empty Content**: If a concept page is empty, try regenerating it.
-   **Support**: Contact the administrator if you encounter persistent issues.
