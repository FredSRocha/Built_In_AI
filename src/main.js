/**
 * Copyright 2025 Fred Rocha
 * SPDX-License-Identifier: Apache-2.0
 */

import "./style.css";
import { initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize FirebaseApp
const firebaseApp = initializeApp(firebaseConfig);

// Initialize the Google AI service
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

// Create a GenerativeModel instance
const model = getGenerativeModel(ai, {
  mode: "prefer_on_device",
  model: "gemini-2.5-flash",
});

// Database setup
const DB_NAME = "AuraTasksDB";
const DB_VERSION = 1;
const STORE_NAME = "tasks";

class TaskScheduler {
  constructor() {
    this.db = null;
    this.tasks = [];
    this.init();
  }

  async init() {
    await this.initDB();
    await this.loadTasks();
    this.displayTodayDate();
    this.renderTasks();
    this.setupEventListeners();
  }

  // IndexedDB initialization
  initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("time", "time", { unique: false });
        }
      };
    });
  }

  // Display Today Date to IndexedDB
  displayTodayDate() {
    const dateElement = document.getElementById("todayDate");
    if (dateElement) {
      const today = new Date();
      const options = {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      };
      dateElement.textContent = today.toLocaleDateString(undefined, options);
    }
  }

  // Save task to IndexedDB
  async saveTask(task) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(task);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Load tasks from IndexedDB
  async loadTasks() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.tasks = request.result.sort(
          (a, b) => new Date(a.time) - new Date(b.time)
        );
        resolve(this.tasks);
      };
    });
  }

  // Delete task from IndexedDB
  async deleteTask(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Update task in IndexedDB
  async updateTask(task) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(task);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Analyze audio/image to extract task information
  async analyzeMedia(prompt, file, type) {
    let sourceId, responseId;

    if (type === "text") {
      sourceId = "textSource";
      responseId = "textResponse";
    } else if (type === "audio") {
      sourceId = "audioSource";
      responseId = "audioResponse";
    } else if (type === "image") {
      sourceId = "imageSource";
      responseId = "imageResponse";
    } else {
      console.error("Unknown analysis type:", type);
      return;
    }

    // Now select the elements using the determined IDs
    const sourceSpan = document.getElementById(sourceId);
    const responsePre = document.getElementById(responseId);

    // Add checks for null elements in case of a missing ID in the HTML
    if (!sourceSpan || !responsePre) {
      console.error(`Missing DOM elements for type: ${type}`);
      return;
    }

    try {
      sourceSpan.innerHTML = await this.getSource();
      responsePre.innerHTML = "Analyzing...";

      let mediaPart;
      if (file) {
        mediaPart = await this.fileToGenerativePart(file);
      }

      const result = await model.generateContentStream(
        file ? [prompt, mediaPart] : [prompt]
      );

      let fullResponse = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        responsePre.innerHTML = fullResponse;
      }

      // Parse the AI response to extract task information
      const taskInfoArray = this.parseTaskFromAI(fullResponse);

      // Check if the result is an array before processing
      if (Array.isArray(taskInfoArray) && taskInfoArray.length > 0) {
        await this.addTasksFromAI(taskInfoArray); // Call the new function
      } else if (taskInfoArray) {
        // Handle the case where parseTaskFromAI might have returned a single object (if not modified in step 1)
        // Since we modified parseTaskFromAI to always return an array, this block is optional but safer
        console.warn(
          "parseTaskFromAI did not return an array. Check implementation."
        );
      }
    } catch (err) {
      console.error(err.name, err.message);
      responsePre.innerHTML = `Error: ${err.message}`;
    }
  }

  // Parse AI response to extract task information
  parseTaskFromAI(aiResponse) {
    try {
      // Look for JSON Array structure in the response (non-greedy match for array)
      // Using the non-greedy object match as a fallback if the array match fails.
      const arrayMatch = aiResponse.match(/\[[\s\S]*?\]/); // Match from [ to ]
      if (arrayMatch) {
        const jsonString = arrayMatch[0].trim();
        const parsedResult = JSON.parse(jsonString);

        // Return the array of tasks.
        if (Array.isArray(parsedResult)) {
          return parsedResult;
        }
      }

      // Fallback: Original logic for a single JSON object (for text analysis or simpler cases)
      const jsonMatch = aiResponse.match(/\{[\s\S]*?\}/); // Non-greedy object match
      if (jsonMatch) {
        const singleTask = JSON.parse(jsonMatch[0].trim());
        return [singleTask]; // Always return an array, even for a single task
      }

      // Fallback: extract task name and time using regex patterns (less reliable)
      const taskMatch = aiResponse.match(
        /(?:task|meeting|appointment):?\s*(.+?)(?=\s*(?:at|on|time:)|$)/i
      );
      const timeMatch = aiResponse.match(
        /(?:at|on|time:)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
      );

      if (taskMatch) {
        return [
          {
            // Wrap the single task in an array
            title: taskMatch[1].trim(),
            time: timeMatch
              ? this.parseTimeString(timeMatch[1])
              : this.getDefaultTime(),
          },
        ];
      }
    } catch (error) {
      console.error("Error parsing AI response:", error);
    }
    return null;
  }

  // Parse time string to Date object
  parseTimeString(timeStr) {
    const now = new Date();
    const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = timeStr.match(timeRegex);

    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] ? parseInt(match[2]) : 0;
      const period = match[3] ? match[3].toLowerCase() : "";

      if (period === "pm" && hours < 12) hours += 12;
      if (period === "am" && hours === 12) hours = 0;

      now.setHours(hours, minutes, 0, 0);
      return now.toISOString();
    }

    return this.getDefaultTime();
  }

  getDefaultTime() {
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    return now.toISOString();
  }

  // Add tasks from AI analysis (handles an array of tasks)
  async addTasksFromAI(taskInfoArray) {
    for (const taskInfo of taskInfoArray) {
      const task = {
        title: taskInfo.title,
        time: taskInfo.time,
        description: taskInfo.description || "",
        created: new Date().toISOString(),
      };

      // Apply conflict resolution to each new task
      const resolvedTask = await this.resolveConflicts(task);
      await this.saveTask(resolvedTask);
    }

    // Load and render tasks only once after all are saved
    await this.loadTasks();
    this.renderTasks();
  }

  // Agentic AI Conflict Resolution
  async resolveConflicts(newTask) {
    const newTaskTime = new Date(newTask.time);

    for (const existingTask of this.tasks) {
      const existingTime = new Date(existingTask.time);
      const timeDiff = Math.abs(newTaskTime - existingTime);
      const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds

      if (timeDiff < oneHour) {
        // Conflict detected - adjust new task to be 1 hour after existing task
        newTaskTime.setTime(existingTime.getTime() + oneHour);
        newTask.time = newTaskTime.toISOString();

        // Update conflict status
        this.updateConflictStatus(
          `Resolved conflict: Moved task to ${newTaskTime.toLocaleTimeString()}`
        );
        break;
      }
    }

    return newTask;
  }

  updateConflictStatus(message) {
    const statusElement = document.getElementById("conflictStatus");
    statusElement.textContent = message;
    statusElement.className = "conflict-status resolved";

    setTimeout(() => {
      statusElement.textContent = "No conflicts detected";
      statusElement.className = "conflict-status";
    }, 5000);
  }

  // Render tasks in ascending order
  renderTasks() {
    const tasksList = document.getElementById("tasksList");
    tasksList.innerHTML = "";

    this.tasks.forEach((task, index) => {
      const taskElement = document.createElement("div");
      taskElement.className = "task-item";
      taskElement.draggable = true;
      taskElement.dataset.taskId = task.id;

      const taskTime = new Date(task.time);
      const timeString = taskTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      taskElement.innerHTML = `
        <div class="task-time">${timeString}</div>
        <div class="task-title">${task.title}</div>
        <div class="task-actions">
          <button class="edit-btn" onclick="taskScheduler.editTask(${task.id})">Edit</button>
          <button class="delete-btn" onclick="taskScheduler.deleteTaskHandler(${task.id})">Delete</button>
        </div>
      `;

      tasksList.appendChild(taskElement);
    });

    this.setupDragAndDrop();
  }

  // Setup drag and drop for task reordering
  setupDragAndDrop() {
    const tasksList = document.getElementById("tasksList");
    let draggedTask = null;

    tasksList.querySelectorAll(".task-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        draggedTask = item;
        item.classList.add("dragging");
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        draggedTask = null;
      });
    });

    tasksList.addEventListener("dragover", (e) => {
      e.preventDefault();
      const afterElement = this.getDragAfterElement(tasksList, e.clientY);
      const draggable = document.querySelector(".dragging");

      if (afterElement == null) {
        tasksList.appendChild(draggable);
      } else {
        tasksList.insertBefore(draggable, afterElement);
      }
    });

    tasksList.addEventListener("drop", (e) => {
      e.preventDefault();
      this.handleTaskReorder();
    });
  }

  getDragAfterElement(container, y) {
    const draggableElements = [
      ...container.querySelectorAll(".task-item:not(.dragging)"),
    ];

    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

  // Handle task reordering and update times
  async handleTaskReorder() {
    const tasksList = document.getElementById("tasksList");
    const taskElements = Array.from(tasksList.querySelectorAll(".task-item"));

    // Update task order and times
    const startTime = new Date();
    startTime.setHours(9, 0, 0, 0); // Start at 9 AM

    for (let i = 0; i < taskElements.length; i++) {
      const taskId = parseInt(taskElements[i].dataset.taskId);
      const task = this.tasks.find((t) => t.id === taskId);

      if (task) {
        const newTime = new Date(startTime);
        newTime.setHours(startTime.getHours() + i);
        task.time = newTime.toISOString();

        await this.updateTask(task);
      }
    }

    await this.loadTasks();
    this.renderTasks();
  }

  // Edit task handler
  async editTask(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (task) {
      const newTitle = prompt("Edit task title:", task.title);
      if (newTitle !== null) {
        task.title = newTitle;
        await this.updateTask(task);
        await this.loadTasks();
        this.renderTasks();
      }
    }
  }

  // Delete task handler
  async deleteTaskHandler(id) {
    if (confirm("Are you sure you want to delete this task?")) {
      await this.deleteTask(id);
      await this.loadTasks();
      this.renderTasks();
    }
  }

  // File to GenerativePart conversion
  async fileToGenerativePart(file) {
    const base64EncodedDataPromise = new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
  }

  // Get AI source
  async getSource() {
    return "LanguageModel" in self &&
      (await LanguageModel.availability()) === "available"
      ? "Built-in AI"
      : "Cloud AI";
  }

  // Setup event listeners
  setupEventListeners() {
    // Text analysis
    document
      .getElementById("analyzeText")
      .addEventListener("click", async () => {
        const textInput = document.getElementById("taskText");
        if (textInput.value.trim()) {
          const prompt = `Analyze this task description and extract task information in JSON format with title, time (ISO string), and description: "${textInput.value}"`;
          await this.analyzeMedia(prompt, null, "text");
          textInput.value = "";
        }
      });

    // Audio analysis
    document
      .getElementById("audioFile")
      .addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          const prompt =
            "Analyze this audio to extract task information like meeting schedules, appointments, or reminders. Return JSON with title, time (ISO string), and description.";
          await this.analyzeMedia(prompt, file, "audio");
        }
      });

    // Image analysis
    document
      .getElementById("imageFile")
      .addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          const prompt =
            "Analyze this image to extract task information like event details, schedules, or appointments from tickets, flyers, or calendars. Return JSON with title, time (ISO string), and description.";
          await this.analyzeMedia(prompt, file, "image");
        }
      });

    // Manual conflict resolution
    document
      .getElementById("resolveConflicts")
      .addEventListener("click", async () => {
        for (const task of this.tasks) {
          await this.resolveConflicts(task);
        }
        await this.loadTasks();
        this.renderTasks();
      });

    // Audio recording (basic implementation)
    document.getElementById("recordAudio").addEventListener("click", () => {
      alert("Audio recording would be implemented here with MediaRecorder API");
    });
  }
}

// Initialize the task scheduler
const taskScheduler = new TaskScheduler();
window.taskScheduler = taskScheduler; // Make it globally available for onclick handlers
