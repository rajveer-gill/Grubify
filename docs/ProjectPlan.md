# Project Plan

## Project Planning and Execution
Our team followed a structured project plan with clear task assignments, regular progress tracking, and flexibility to handle challenges. Key components of our planning process included:
- Clearly defining roles and responsibilities.
- Holding Scrum meetings twice weekly (Mondays & Wednesdays at 3:20 PM) after class, with additional video calls on Thursdays when necessary.
- Maintaining detailed records of completed work, pending tasks, and encountered issues.

---

## Team Organization

| Team Member | Role & Responsibilities |
|---------------|--------------------------|
| **John** | Frontend/UI - Designed and implemented the entire UI using React, ensuring smooth user interactions. |
| **Manu** | Backend/API/UI - Integrated the Kroger API for cart handling, managed user authentication, added a loading screen for the "Continue with Kroger" button, and implemented buttons to redirect users to their cart after adding items. |
| **Tim** | Backend/API - Developed product search functionality and store location search by zip code using the Kroger API. |
| **Raj** | API/UI - Integrated OpenAI’s API to generate ingredient lists and recipes. Assisted in user authentication for cart access and contributed to UI improvements. |
| **Myles** | Database/UI - Implemented the "Store Recipe & Ingredients" feature, allowing users to save past recipes in a database, and ensured proper frontend display. |

---

## Decision-Making and Communication
- Decisions were made collaboratively during Scrum meetings (Mondays & Wednesdays), with urgent issues resolved via video calls or group chat.
- GitHub was used for version control, code reviews, and issue tracking.
- Slack/Discord (or another messaging platform) was used for daily team communication and quick troubleshooting.
- Code reviews were conducted before merging major changes to maintain code quality.

---

## Task Assignments and Contributions

| Team Member | Role & Responsibilities | Assigned Date | Completion Date | Time Spent | Files Worked On (Time Spent & Completion Date) |
|---------------|--------------------------|----------------|----------------|---------------|----------------|
| **John** | Frontend UI development | Feb 24, 2025 | Mar 10, 2025 | 12.5 hours | `NutrifyAI.js` (7 hrs, Finished Mar 8), `NutrifyAI.css` (5.5 hrs, Finished Mar 10) |
| **Manu** | Backend/API/UI integration | Feb 24, 2025 | Mar 10, 2025 | 14 hours | `user.py` (6 hrs, Finished Mar 7), `item_search.py` (4 hrs, Finished Mar 8), `NutrifyAI.js` (4 hrs, Finished Mar 9) |
| **Tim** | API integration (Store & Product Search) | Feb 24, 2025 | Mar 10, 2025 | 8 hours | `store_handler.py` (4 hrs, Finished Mar 7), `store_handler_test.py` (4 hrs, Finished Mar 9) |
| **Raj** | AI Integration & System Setup | Feb 24, 2025 | Mar 10, 2025 | 15 hours | `NutrifyAI.js` (5 hrs, Finished Mar 6), `NutrifyAI.css` (3 hrs, Finished Mar 7), `app.py` (4 hrs, Finished Mar 9), Initial system setup (3 hrs, Finished Mar 10) |
| **Myles** | Database & UI Improvements | Feb 24, 2025 | Mar 10, 2025 | 14 hours | `data.py` (6 hrs, Finished Mar 8), `test.py` (3 hrs, Finished Mar 9), `NutrifyAI.js` (5 hrs, Finished Mar 10) |

---

## Project Milestones and Adaptability

### Week 1: Requirements & Design
- Requirements Gathering (Day 1-2): Defined core functionalities and user needs.
- System & UI/UX Design (Day 3-4): Created system architecture and UI wireframes.
- Setup & Initial Development (Day 5-7): Set up project repository, initialized CI/CD pipelines, and built the foundational frontend (React) and backend (Flask).

### Week 2: Core Development & Integration
- Core Feature Implementation (Day 8-10): 
  - Implemented Recipe Parser module.
  - Built the frontend UI for meal input.
- API Integration (Day 11-12):
  - Integrated Kroger API (for product search & cart handling).
  - Connected OpenAI API to generate recipes.
- Shopping Cart Functionality (Day 13-14): 
  - Developed the shopping cart automation with seamless redirection to Kroger.
  - Implemented loading screens for better UX.

### Week 3: Testing, Feedback & Delivery
- Testing & Debugging (Day 15-16): 
  - Conducted unit tests & integration tests for API calls.
  - Debugged cart & authentication issues.
- User Testing & Feedback (Day 17): 
  - Gathered user feedback & improved UI responsiveness.
- Final Testing & Documentation (Day 18-19): 
  - Wrote technical documentation and user guides.
- Deployment & Final Adjustments (Day 20-21): 
  - Verified performance & security of the system.
  - Completed final bug fixes before submission.

---

## Risk Assessment and Mitigation

| Risk | Mitigation Strategy |
|---------|----------------------|
| Kroger API rate limits | Implemented caching to minimize API calls. |
| Authentication failures | Used session storage and OAuth error handling for robustness. |
| Data inconsistencies | Ensured validation of data before processing. |
| Frontend & Backend Integration issues | Conducted frequent API testing to verify communication between services. |
| Unfamiliarity with Kroger API | Dedicated time to researching API documentation before development. |
| System downtime or server issues | Deployed locally first and maintained backups before full integration. |

---

## Tracking Progress
- GitHub: 
  - Used for version control, pull requests, and issue tracking.
  - Each member committed changes with detailed messages.
- Scrum Meetings (Mondays & Wednesdays, 3:20 PM): 
  - Reviewed completed work.
  - Discussed blockers and made adjustments.
- Code Reviews & Testing: 
  - Every major feature underwent a peer review before merging.
- Task Management Tools: 
  - Tracked progress using GitHub Issues & Kanban boards.

---

## Final Summary
By maintaining a well-structured development process, frequent communication, and proactive problem-solving, we successfully completed a fully functional system integrating Kroger’s API for shopping cart management, OpenAI’s API for recipe generation, and database storage for recipe saving. The project was completed on time, with a strong focus on usability and seamless API integration.
