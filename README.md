# Blacklist Post Generator

![Imgur](https://imgur.com/VnMJhn4.jpg)

This is a powerful, client-side web application designed to help users efficiently create, format, save, and manage detailed social media alerts or "blacklist" posts. It is built with HTML, Tailwind CSS, and vanilla JavaScript, and it uses the browser's local storage to save all data directly on the user's computer for complete privacy and simplicity.

## Key Features
**Content & Formatting**
 * **Rich Content Creation**: Dedicated fields for main case information, subject details, key updates, and trial dates.
 * **Dynamic, Reorderable Sections**: Easily add, remove, and reorder multiple entries for:
   * Blacklisted Individuals (with contact info and social media)
   * Aliases
   * Associated Organizations
   * Legal Registrations
   * Allegations of Fraud
   * First-Hand Accounts and Warnings
   * Animal Cruelty Investigations
   * Enhanced Documentation & Evidence (with titles, descriptions, and dates)
   * News Articles & Legal Documents
 * **Live Preview**: See a real-time, formatted preview of your post as you type, including bold, italics, and clickable links.
 * **Character Count**: Keep track of your post's length to meet social media platform limits.
 * **Copy to Clipboard**: Instantly copy the fully formatted post text, ready to be pasted on any social media platform.
   
## Data Management & Persistence
 * **Autosave**: Your work is automatically saved as a draft every 10 seconds. If you accidentally close the tab, the app will offer to restore your unsaved work upon your return.
 * **Local Storage System**:
   * **Save & Update**: Save your current post with a custom name, or update a previously saved post.
   * **Save As...**: Easily duplicate an existing post to create a new version.
   * **Load & Search**: Browse all your saved posts in a convenient modal that includes a live search bar to quickly find the entry you need.
   * **Delete**: Remove posts you no longer need.
 * **Import/Export Functionality**:
   * **Export All Posts**: Download a single JSON file containing all your saved posts as a secure backup.
   * **Import Posts**: Upload a previously exported JSON file to restore your posts or transfer them to a different browser or computer.
     
## User Experience & UI Enhancements
 * **Light & Dark Mode**: Toggle between a clean light theme and an eye-friendly dark mode. Your preference is saved automatically.
 * **Responsive Design**: A modern, user-friendly interface that works seamlessly on both desktop and mobile devices.
 * **Collapsible Sections**: Each form section can be collapsed to help you focus on the information you are currently editing.
 * **Intuitive Controls**:
   * "Move Up/Down" arrows for list items are automatically disabled when an item is at the top or bottom.
   * Buttons provide visual feedback when clicked.
   * The "Copy" button confirms success by changing its text to "✔ Copied!".
 * **Smart Form Fields**: Inputs for email, phone, and URLs use the correct HTML types for better mobile usability and browser auto-completion.
 * **Polished UI**: A sticky header with a subtle shadow on scroll keeps main actions accessible, and empty sections display a clear "No items added yet" message.
   
## Tech Stack
 * **HTML5**: For the structure of the application.
 * **Tailwind CSS**: For all utility-first styling and the dark mode implementation.
 * **JavaScript (Vanilla)**: For all application logic, including DOM manipulation, event handling, data management, and all interactive features.
   
## How to Use
 1. Open the index.html file in any modern web browser (like Chrome, Firefox, or Safari), or visit the live GitHub Pages link.
 2. Fill out the form fields. Use the "Add" buttons within each section to create new list items.
 3. The Live Preview on the right will update automatically as you type.
 4. To save your work for later, click "Save" or "Save As..." and give your post a name.
 5. To load a previous post, click "Load Posts", use the search bar if needed, and select a post from the list.
 6. When you are ready to share, click the "Copy to Clipboard" button.

Since this tool uses local storage, all your saved data remains in your browser. Clearing your browser's site data for this page will erase your saved posts, so be sure to use the Export feature to create backups.
