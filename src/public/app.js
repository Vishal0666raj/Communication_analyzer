/**
 * src/public/app.js
 * Core frontend logic for the AI Communication Coach.
 * Manages authentication, SPA view transitions, file uploads with progress telemetry,
 * job status polling, and reports rendering (with timeline filters).
 */

const API_BASE = 'http://localhost:8000'; // Same origin

// App State
const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  jobs: [], // Array of Job objects { id, filename, date, status, progress, error }
  activePolls: {}, // Map of jobId -> intervalId
  currentReport: null
};

// DOM Elements
const el = {
  app: document.getElementById('app'),
  authSection: document.getElementById('auth-section'),
  workspaceSection: document.getElementById('workspace-section'),
  
  // Forms
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginEmail: document.getElementById('login-email'),
  loginPass: document.getElementById('login-password'),
  regName: document.getElementById('register-name'),
  regEmail: document.getElementById('register-email'),
  regPass: document.getElementById('register-password'),
  authTitle: document.getElementById('auth-title'),
  authSubtitle: document.getElementById('auth-subtitle'),
  goToRegister: document.getElementById('go-to-register'),
  goToLogin: document.getElementById('go-to-login'),
  authAlert: document.getElementById('auth-alert'),
  
  // Navigation
  navDashboard: document.getElementById('nav-dashboard'),
  navLogout: document.getElementById('nav-logout'),
  userDisplayName: document.getElementById('user-display-name'),
  avatarLetters: document.getElementById('avatar-letters'),
  pageTitle: document.getElementById('page-title'),
  
  // Subviews
  dashboardSubview: document.getElementById('dashboard-subview'),
  reportSubview: document.getElementById('report-subview'),
  
  // Upload
  dropZone: document.getElementById('drop-zone'),
  videoInput: document.getElementById('video-file-input'),
  uploadProgressContainer: document.getElementById('upload-progress-container'),
  uploadFilename: document.getElementById('upload-filename'),
  uploadProgressBar: document.getElementById('upload-progress-bar'),
  uploadPercentage: document.getElementById('upload-percentage'),
  
  // Lists
  jobsListBody: document.getElementById('jobs-list-body'),
  
  // Report View
  btnBackDashboard: document.getElementById('btn-back-dashboard'),
  reportFileName: document.getElementById('report-file-name'),
  overallScoreNum: document.getElementById('overall-score-num'),
  gaugeFill: document.querySelector('.gauge-fill'),
  speakingSpeedVal: document.getElementById('speaking-speed-val'),
  reportSummaryText: document.getElementById('report-summary-text'),
  fillerCountNum: document.getElementById('filler-count-num'),
  pausesCountNum: document.getElementById('pauses-count-num'),
  timelineCountNum: document.getElementById('timeline-count-num'),
  
  // Competencies
  scoreConfidence: document.getElementById('score-confidence'),
  fillConfidence: document.getElementById('fill-confidence'),
  scoreEyeContact: document.getElementById('score-eye-contact'),
  fillEyeContact: document.getElementById('fill-eye-contact'),
  scorePosture: document.getElementById('score-posture'),
  fillPosture: document.getElementById('fill-posture'),
  scoreGesture: document.getElementById('score-gesture'),
  fillGesture: document.getElementById('fill-gesture'),
  scoreBodyLanguage: document.getElementById('score-body-language'),
  fillBodyLanguage: document.getElementById('fill-body-language'),
  scoreGrammar: document.getElementById('score-grammar'),
  fillGrammar: document.getElementById('fill-grammar'),
  scoreVocabulary: document.getElementById('score-vocabulary'),
  fillVocabulary: document.getElementById('fill-vocabulary'),
  scoreCommunication: document.getElementById('score-communication'),
  fillCommunication: document.getElementById('fill-communication'),
  
  // Strengths & Weaknesses
  strengthsList: document.getElementById('strengths-list'),
  weaknessesList: document.getElementById('weaknesses-list'),
  
  // Timeline
  timelineList: document.getElementById('timeline-list'),
  timelineFilters: document.querySelectorAll('.filter-btn')
};

// Initial setup
const init = async () => {
  setupEventListeners();
  
  if (state.token) {
    try {
      await fetchUserProfile();
      showWorkspace();
      loadSavedJobs();
    } catch (err) {
      logout();
    }
  } else {
    showAuth();
  }
};

// Event Listeners Registration
const setupEventListeners = () => {
  // Auth Switchers
  el.goToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    el.loginForm.classList.add('hidden');
    el.registerForm.classList.remove('hidden');
    el.authTitle.textContent = 'Create Account';
    el.authSubtitle.textContent = 'Get feedback on your communication skills';
    hideAlert();
  });
  
  el.goToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    el.registerForm.classList.add('hidden');
    el.loginForm.classList.remove('hidden');
    el.authTitle.textContent = 'Welcome Back';
    el.authSubtitle.textContent = 'Log in to check your speaking sessions';
    hideAlert();
  });

  // Forms Submissions
  el.loginForm.addEventListener('submit', handleLogin);
  el.registerForm.addEventListener('submit', handleRegister);
  
  // Navigation
  el.navLogout.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
  el.navDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    showDashboardView();
  });
  el.btnBackDashboard.addEventListener('click', showDashboardView);
  
  // Upload Drop Zone events
  el.dropZone.addEventListener('click', () => el.videoInput.click());
  el.videoInput.addEventListener('change', handleFileSelection);
  
  el.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropZone.style.borderColor = 'var(--primary-color)';
    el.dropZone.style.backgroundColor = 'rgba(27, 116, 228, 0.02)';
  });
  
  el.dropZone.addEventListener('dragleave', () => {
    el.dropZone.style.borderColor = '#cbd5e1';
    el.dropZone.style.backgroundColor = '#f8fafc';
  });
  
  el.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropZone.style.borderColor = '#cbd5e1';
    el.dropZone.style.backgroundColor = '#f8fafc';
    if (e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });

  // Timeline Filtering
  el.timelineFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      el.timelineFilters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterTimeline(btn.dataset.category);
    });
  });
};

// --- AUTHENTICATION FLOW ---

async function handleLogin(e) {
  e.preventDefault();
  hideAlert();
  
  const payload = {
    email: el.loginEmail.value,
    password: el.loginPass.value
  };

  try {
    const res = await apiRequest('/api/auth/login', 'POST', payload);
    saveAuth(res.token);
    await fetchUserProfile();
    showWorkspace();
    loadSavedJobs();
  } catch (err) {
    showAlert(err.message || 'Login failed. Please check your credentials.');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  hideAlert();

  const payload = {
    name: el.regName.value,
    email: el.regEmail.value,
    password: el.regPass.value
  };

  try {
    const res = await apiRequest('/api/auth/register', 'POST', payload);
    saveAuth(res.token);
    await fetchUserProfile();
    showWorkspace();
    loadSavedJobs();
  } catch (err) {
    showAlert(err.message || 'Registration failed. Try again.');
  }
}

const saveAuth = (token) => {
  state.token = token;
  localStorage.setItem('token', token);
};

const logout = () => {
  // Clear polling intervals
  Object.values(state.activePolls).forEach(clearInterval);
  state.activePolls = {};
  
  state.token = null;
  state.user = null;
  state.jobs = [];
  localStorage.removeItem('token');
  
  el.loginEmail.value = '';
  el.loginPass.value = '';
  el.regName.value = '';
  el.regEmail.value = '';
  el.regPass.value = '';
  
  showAuth();
};

async function fetchUserProfile() {
  const res = await apiRequest('/api/users/me', 'GET');
  state.user = res.data.user;
  
  // Update UI profile badge
  el.userDisplayName.textContent = state.user.name;
  const initials = state.user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  el.avatarLetters.textContent = initials;
}

const showAuth = () => {
  el.app.className = 'logged-out';
  el.authSection.classList.remove('hidden');
  el.workspaceSection.classList.add('hidden');
};

const showWorkspace = () => {
  el.app.className = 'logged-in';
  el.authSection.classList.add('hidden');
  el.workspaceSection.classList.remove('hidden');
  showDashboardView();
};

const showAlert = (msg) => {
  el.authAlert.textContent = msg;
  el.authAlert.classList.remove('hidden');
};

const hideAlert = () => {
  el.authAlert.classList.add('hidden');
};

// --- API WRAPPER ---

async function apiRequest(path, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const config = {
    method,
    headers
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${path}`, config);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  
  return data;
}

// --- FILE UPLOAD ---

function handleFileSelection(e) {
  if (e.target.files.length > 0) {
    uploadFile(e.target.files[0]);
  }
}

function uploadFile(file) {
  el.uploadFilename.textContent = file.name;
  el.uploadProgressContainer.classList.remove('hidden');
  el.uploadProgressBar.style.width = '0%';
  el.uploadPercentage.textContent = '0%';
  
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('video', file);

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      el.uploadProgressBar.style.width = `${pct}%`;
      el.uploadPercentage.textContent = `${pct}%`;
    }
  });

  xhr.addEventListener('load', () => {
    el.uploadProgressContainer.classList.add('hidden');
    if (xhr.status >= 200 && xhr.status < 300) {
      const res = JSON.parse(xhr.responseText);
      const newJob = {
        id: res.data.job.id,
        filename: file.name,
        date: new Date().toLocaleString(),
        status: res.data.job.status,
        progress: res.data.job.progress,
        error: null
      };
      
      // Prepend to state
      state.jobs.unshift(newJob);
      saveJobsToLocalStorage();
      renderJobsTable();
      
      // Start checking status
      startJobPolling(newJob.id);
    } else {
      let errMsg = 'File upload failed.';
      try {
        const errJson = JSON.parse(xhr.responseText);
        errMsg = errJson.message || errMsg;
      } catch(e){}
      alert(errMsg);
    }
  });

  xhr.addEventListener('error', () => {
    el.uploadProgressContainer.classList.add('hidden');
    alert('Network error occurred during upload.');
  });

  xhr.open('POST', `${API_BASE}/api/upload-video`);
  if (state.token) {
    xhr.setRequestHeader('Authorization', `Bearer ${state.token}`);
  }
  xhr.send(formData);
}

// --- JOB POLUNG QUEUE ---

const loadSavedJobs = () => {
  const key = `jobs_${state.user.id}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      state.jobs = JSON.parse(saved);
      renderJobsTable();
      
      // Resume polling for any running jobs
      state.jobs.forEach(job => {
        if (job.status === 'QUEUED' || job.status === 'PROCESSING') {
          startJobPolling(job.id);
        }
      });
    } catch (e) {
      state.jobs = [];
    }
  } else {
    state.jobs = [];
    renderJobsTable();
  }
};

const saveJobsToLocalStorage = () => {
  const key = `jobs_${state.user.id}`;
  localStorage.setItem(key, JSON.stringify(state.jobs));
};

const startJobPolling = (jobId) => {
  if (state.activePolls[jobId]) return;
  
  // Poll status every 3 seconds
  const intervalId = setInterval(() => pollJobStatus(jobId), 3000);
  state.activePolls[jobId] = intervalId;
};

async function pollJobStatus(jobId) {
  try {
    const res = await apiRequest(`/api/jobs/${jobId}/status`, 'GET');
    const { status, progress, error } = res.data;
    
    // Find job in state and update
    const jobIndex = state.jobs.findIndex(j => j.id === jobId);
    if (jobIndex !== -1) {
      state.jobs[jobIndex].status = status;
      state.jobs[jobIndex].progress = progress;
      state.jobs[jobIndex].error = error;
      
      saveJobsToLocalStorage();
      renderJobsTable();
      
      // Stop polling on completion/failure
      if (status === 'COMPLETED' || status === 'FAILED') {
        clearInterval(state.activePolls[jobId]);
        delete state.activePolls[jobId];
      }
    }
  } catch (err) {
    console.error(`Error polling job ${jobId}`, err);
    // On repeated API failures, clear polling
    clearInterval(state.activePolls[jobId]);
    delete state.activePolls[jobId];
  }
}

// --- RENDER DASHBOARD TABLES ---

const renderJobsTable = () => {
  el.jobsListBody.innerHTML = '';
  
  if (state.jobs.length === 0) {
    el.jobsListBody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">No upload sessions found. Get started by uploading a video!</td>
      </tr>
    `;
    return;
  }

  state.jobs.forEach(job => {
    const tr = document.createElement('tr');
    
    // Date
    const tdDate = document.createElement('td');
    tdDate.textContent = job.date;
    tr.appendChild(tdDate);
    
    // Filename
    const tdName = document.createElement('td');
    tdName.textContent = job.filename;
    tr.appendChild(tdName);
    
    // Status Badge
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `status-badge status-${job.status.toLowerCase()}`;
    badge.textContent = job.status;
    tdStatus.appendChild(badge);
    tr.appendChild(tdStatus);
    
    // Progress
    const tdProgress = document.createElement('td');
    const progWrapper = document.createElement('div');
    progWrapper.className = 'table-progress';
    
    const track = document.createElement('div');
    track.className = 'progress-track';
    track.style.flexGrow = '1';
    
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.style.width = `${job.progress}%`;
    track.appendChild(bar);
    
    const pct = document.createElement('span');
    pct.className = 'table-progress-percentage';
    pct.textContent = `${job.progress}%`;
    
    progWrapper.appendChild(track);
    progWrapper.appendChild(pct);
    tdProgress.appendChild(progWrapper);
    tr.appendChild(tdProgress);
    
    // Actions
    const tdActions = document.createElement('td');
    const actionsWrapper = document.createElement('div');
    actionsWrapper.style.display = 'flex';
    actionsWrapper.style.gap = '8px';
    
    if (job.status === 'COMPLETED') {
      const btnView = document.createElement('button');
      btnView.className = 'btn btn-primary';
      btnView.style.padding = '6px 12px';
      btnView.style.fontSize = '12px';
      btnView.textContent = 'View Report';
      btnView.addEventListener('click', () => loadAndShowReport(job.id, job.filename));
      actionsWrapper.appendChild(btnView);
    }
    
    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-secondary';
    btnDel.style.padding = '6px 12px';
    btnDel.style.fontSize = '12px';
    btnDel.textContent = 'Delete';
    btnDel.addEventListener('click', () => deleteJob(job.id));
    actionsWrapper.appendChild(btnDel);
    
    tdActions.appendChild(actionsWrapper);
    tr.appendChild(tdActions);
    
    el.jobsListBody.appendChild(tr);
  });
};

async function deleteJob(jobId) {
  if (!confirm('Are you sure you want to delete this speaking session and its report?')) return;
  
  try {
    await apiRequest(`/api/jobs/${jobId}`, 'DELETE');
    
    // Remove from state
    state.jobs = state.jobs.filter(j => j.id !== jobId);
    
    // Clear interval if active
    if (state.activePolls[jobId]) {
      clearInterval(state.activePolls[jobId]);
      delete state.activePolls[jobId];
    }
    
    saveJobsToLocalStorage();
    renderJobsTable();
  } catch (err) {
    alert(`Could not delete job: ${err.message}`);
  }
}

// --- RENDER COACHING REPORTS ---

async function loadAndShowReport(jobId, filename) {
  try {
    el.pageTitle.textContent = 'Coaching Analysis';
    el.reportFileName.textContent = filename;
    
    const res = await apiRequest(`/api/reports/${jobId}`, 'GET');
    state.currentReport = res.data.report;
    
    renderReportDetails();
    
    el.dashboardSubview.classList.add('hidden');
    el.reportSubview.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    alert(`Could not load report: ${err.message}`);
  }
}

const renderReportDetails = () => {
  const rep = state.currentReport;
  
  // 1. Render Radial gauge
  el.overallScoreNum.textContent = rep.overallScore;
  // stroke-dashoffset = 314 * (1 - score/100)
  const offset = 314 * (1 - rep.overallScore / 100);
  el.gaugeFill.style.strokeDashoffset = offset;
  
  // WPM
  el.speakingSpeedVal.textContent = rep.speakingSpeed || 0;
  
  // Header statistics bar
  el.reportSummaryText.textContent = rep.summary;
  el.fillerCountNum.textContent = rep.fillerWords.length;
  el.pausesCountNum.textContent = rep.pauses.length;
  el.timelineCountNum.textContent = rep.timeline.length;
  
  // 2. Render sub-scores competencies
  const scores = [
    { key: 'confidence', val: rep.confidenceScore },
    { key: 'eye-contact', val: rep.eyeContactScore },
    { key: 'posture', val: rep.postureScore },
    { key: 'gesture', val: rep.gestureScore },
    { key: 'body-language', val: rep.bodyLanguageScore },
    { key: 'grammar', val: rep.grammarScore },
    { key: 'vocabulary', val: rep.vocabularyScore },
    { key: 'communication', val: rep.communicationScore }
  ];
  
  scores.forEach(s => {
    document.getElementById(`score-${s.key}`).textContent = `${s.val}%`;
    document.getElementById(`fill-${s.key}`).style.width = `${s.val}%`;
  });
  
  // 3. Render strengths and weaknesses lists
  el.strengthsList.innerHTML = '';
  rep.strengths.forEach(str => {
    const li = document.createElement('li');
    li.textContent = str;
    el.strengthsList.appendChild(li);
  });
  
  el.weaknessesList.innerHTML = '';
  rep.weaknesses.forEach(wk => {
    const li = document.createElement('li');
    li.textContent = wk;
    el.weaknessesList.appendChild(li);
  });
  
  // 4. Render timeline items
  filterTimeline('all');
};

const filterTimeline = (category) => {
  el.timelineList.innerHTML = '';
  const timeline = state.currentReport.timeline || [];
  
  const filtered = category.toLowerCase() === 'all' 
    ? timeline 
    : timeline.filter(item => item.category.toLowerCase() === category.toLowerCase());
    
  if (filtered.length === 0) {
    el.timelineList.innerHTML = `<div class="timeline-empty">No alerts flagged in this category. Excellent speech delivery!</div>`;
    return;
  }

  filtered.forEach(item => {
    const div = document.createElement('div');
    div.className = 'timeline-item';
    
    // Get style key based on category
    let catKey = 'speech';
    if (item.category.toLowerCase() === 'eye contact') catKey = 'eye-contact';
    if (item.category.toLowerCase() === 'posture') catKey = 'posture';
    if (item.category.toLowerCase() === 'gesture') catKey = 'gesture';
    
    div.innerHTML = `
      <div class="timeline-node node-${catKey}"></div>
      <div class="timeline-box">
        <div class="timeline-time-badge">${item.startTime} - ${item.endTime}</div>
        <div class="timeline-details">
          <span class="timeline-category-tag tag-${catKey}">${item.category}</span>
          <h4>${item.issue}</h4>
          <p>${item.suggestion}</p>
        </div>
      </div>
    `;
    
    el.timelineList.appendChild(div);
  });
};

// --- VIEW TRANSITIONS ---

const showDashboardView = () => {
  el.pageTitle.textContent = 'Dashboard';
  el.dashboardSubview.classList.remove('hidden');
  el.reportSubview.classList.add('hidden');
  state.currentReport = null;
  
  // Re-enable active navigation styling
  el.navDashboard.classList.add('active');
};

const showDashboardSubViewOnly = () => {
  el.dashboardSubview.classList.remove('hidden');
  el.reportSubview.classList.add('hidden');
};

// Run app init
window.addEventListener('DOMContentLoaded', init);
