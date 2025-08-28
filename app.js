// Judging System Application JavaScript

// Make functions globally available immediately
window.showLoginModal = showLoginModal;
window.hideLoginModal = hideLoginModal;
window.showAddJudgeModal = showAddJudgeModal;
window.hideAddJudgeModal = hideAddJudgeModal;
window.updateJudgePassword = updateJudgePassword;
window.removeJudge = removeJudge;
window.showLeaderboard = showLeaderboard;
window.downloadLeaderboardCSV = downloadLeaderboardCSV;
window.resetAllData = resetAllData;
window.backToAdmin = backToAdmin;
window.backToDashboard = backToDashboard;
window.logout = logout;

const firebaseConfig = {
  apiKey: "AIzaSyDAYFBfgOTIEq4Jv2ZgXXcFouAXixp5i-Y",
  authDomain: "scoring-ce40d.firebaseapp.com",
  projectId: "scoring-ce40d",
  storageBucket: "scoring-ce40d.firebasestorage.app",
  messagingSenderId: "1056263661432",
  appId: "1:1056263661432:web:885eec66405b21f9358a8d"
};

let currentUser = null;
let currentUserType = null;
let currentTeam = null;
let judges = [];
let teams = [];
let db = null;

// Sample data for offline/demo functionality
const sampleData = {
    adminPassword: "admin123",
    sampleJudges: [
        {id: "judge1", name: "Dr. Smith", password: "judge123"},
        {id: "judge2", name: "Prof. Johnson", password: "judge456"}
    ],
    sampleTeams: [
        {id: "pe20298", name: "Team Alpha", scores: {}},
        {id: "pe20299", name: "Team Beta", scores: {}},
        {id: "pe20300", name: "Team Gamma", scores: {}}
    ]
};

// Initialize with sample data for demo
let localData = {
    admin: {password: sampleData.adminPassword},
    judges: [...sampleData.sampleJudges],
    teams: [...sampleData.sampleTeams],
    leaderboard: []
};

// Initialize Firebase with error handling
async function initializeFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            console.log('Firebase initialized successfully');
            return true;
        }
    } catch (error) {
        console.log('Firebase initialization failed, using local data:', error);
    }
    return false;
}

// Utility Functions
function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.remove('hidden');
    }
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

// Authentication Functions
async function verifyAdminPassword(password) {
    if (db) {
        try {
            const adminDoc = await db.collection('admin').doc('admin1').get();
            if (adminDoc.exists) {
                return adminDoc.data().password === password;
            }
        } catch (error) {
            console.log('Firebase admin check failed, using local data');
        }
    }
    
    // Fallback to local data
    return localData.admin.password === password;
}

async function verifyJudgePassword(password) {
    if (db) {
        try {
            const judgesSnapshot = await db.collection('judges').get();
            let matchedJudge = null;
            
            judgesSnapshot.forEach(doc => {
                const judge = doc.data();
                if (judge.password === password) {
                    matchedJudge = { id: doc.id, ...judge };
                }
            });
            
            if (matchedJudge) return matchedJudge;
        } catch (error) {
            console.log('Firebase judge check failed, using local data');
        }
    }
    
    // Fallback to local data
    return localData.judges.find(judge => judge.password === password);
}

// Login Modal Functions
function showLoginModal(type) {
    console.log('showLoginModal called with type:', type); // Debug log
    
    const modal = document.getElementById('login-modal');
    const title = document.getElementById('login-modal-title');
    const passwordInput = document.getElementById('login-password');
    
    if (!modal || !title || !passwordInput) {
        console.error('Modal elements not found');
        return;
    }
    
    if (type === 'admin') {
        title.textContent = 'Admin Login';
    } else {
        title.textContent = 'Judge Login';
    }
    
    modal.classList.remove('hidden');
    modal.dataset.loginType = type;
    
    // Clear any previous values and focus
    passwordInput.value = '';
    setTimeout(() => passwordInput.focus(), 100);
}

function hideLoginModal() {
    const modal = document.getElementById('login-modal');
    const form = document.getElementById('login-form');
    
    if (modal) {
        modal.classList.add('hidden');
    }
    if (form) {
        form.reset();
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();
    
    const password = document.getElementById('login-password').value;
    const modal = document.getElementById('login-modal');
    const loginType = modal.dataset.loginType;
    
    if (!password.trim()) {
        showToast('Please enter a password', 'error');
        return;
    }
    
    showLoading();
    
    try {
        if (loginType === 'admin') {
            const isValid = await verifyAdminPassword(password);
            if (isValid) {
                currentUser = { id: 'admin1', name: 'Administrator' };
                currentUserType = 'admin';
                hideLoginModal();
                showPage('admin-dashboard');
                await loadAdminDashboard();
                showToast('Admin login successful');
            } else {
                showToast('Invalid admin password', 'error');
            }
        } else {
            const judge = await verifyJudgePassword(password);
            if (judge) {
                currentUser = judge;
                currentUserType = 'judge';
                hideLoginModal();
                showPage('judge-dashboard');
                await loadJudgeDashboard();
                showToast(`Welcome, ${judge.name}`);
            } else {
                showToast('Invalid judge password', 'error');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
    }
    
    hideLoading();
}

// Judge Dashboard Functions
async function loadJudgeDashboard() {
    const judgeNameElement = document.getElementById('judge-name');
    if (judgeNameElement && currentUser) {
        judgeNameElement.textContent = currentUser.name;
    }
    await loadTeamsForJudge();
}

async function loadTeamsForJudge() {
    try {
        let teams = [];
        
        if (db) {
            const teamsSnapshot = await db.collection('teams').get();
            teamsSnapshot.forEach(doc => {
                teams.push({ id: doc.id, ...doc.data() });
            });
        } else {
            teams = [...localData.teams];
        }
        
        const teamsGrid = document.getElementById('teams-grid');
        if (teamsGrid) {
            teamsGrid.innerHTML = '';
            
            teams.forEach(team => {
                const isGraded = team.scores && team.scores[currentUser.id];
                
                const teamCard = document.createElement('div');
                teamCard.className = `team-card ${isGraded ? 'graded' : ''}`;
                teamCard.onclick = () => {
                    if (!isGraded) {
                        selectTeamForScoring(team);
                    } else {
                        showToast('You have already scored this team', 'warning');
                    }
                };
                
                teamCard.innerHTML = `
                    <h3>${team.name}</h3>
                    <p>Team ID: ${team.id}</p>
                    <div class="team-status ${isGraded ? 'graded' : 'not-graded'}">
                        ${isGraded ? 'Graded' : 'Not Graded'}
                    </div>
                `;
                
                teamsGrid.appendChild(teamCard);
            });
        }
    } catch (error) {
        console.error('Error loading teams:', error);
        showToast('Error loading teams', 'error');
    }
}

function selectTeamForScoring(team) {
    currentTeam = team;
    const teamNameElement = document.getElementById('scoring-team-name');
    if (teamNameElement) {
        teamNameElement.textContent = team.name;
    }
    showPage('scoring-page');
    resetScoringForm();
}

function resetScoringForm() {
    const form = document.getElementById('scoring-form');
    if (form) {
        form.reset();
        updateAverageScore();
    }
}

function updateAverageScore() {
    const fields = ['uniqueness', 'presentation', 'workingModel', 'impactFuture', 'scalability'];
    let total = 0;
    
    fields.forEach(field => {
        const element = document.getElementById(field);
        if (element) {
            const value = parseFloat(element.value) || 0;
            total += value;
        }
    });
    
    const average = fields.length > 0 ? (total / fields.length).toFixed(2) : '0.00';
    const averageElement = document.getElementById('average-score');
    if (averageElement) {
        averageElement.textContent = average;
    }
}

// Handle scoring form submission
async function handleScoring(e) {
    e.preventDefault();
    
    const scores = {
        uniqueness: parseFloat(document.getElementById('uniqueness').value) || 0,
        presentation: parseFloat(document.getElementById('presentation').value) || 0,
        workingModel: parseFloat(document.getElementById('workingModel').value) || 0,
        impactFuture: parseFloat(document.getElementById('impactFuture').value) || 0,
        scalability: parseFloat(document.getElementById('scalability').value) || 0
    };
    
    const avgScore = (scores.uniqueness + scores.presentation + scores.workingModel + scores.impactFuture + scores.scalability) / 5;
    scores.avgScore = parseFloat(avgScore.toFixed(2));
    
    showLoading();
    
    try {
        if (db) {
            await db.collection('teams').doc(currentTeam.id).update({
                [`scores.${currentUser.id}`]: scores
            });
        } else {
            // Update local data
            const teamIndex = localData.teams.findIndex(t => t.id === currentTeam.id);
            if (teamIndex !== -1) {
                if (!localData.teams[teamIndex].scores) {
                    localData.teams[teamIndex].scores = {};
                }
                localData.teams[teamIndex].scores[currentUser.id] = scores;
            }
        }
        
        showToast('Scores submitted successfully');
        backToDashboard();
        await updateLeaderboard();
    } catch (error) {
        console.error('Error submitting scores:', error);
        showToast('Error submitting scores', 'error');
    }
    
    hideLoading();
}

function backToDashboard() {
    if (currentUserType === 'judge') {
        showPage('judge-dashboard');
        loadTeamsForJudge();
    } else {
        showPage('admin-dashboard');
    }
}

// Admin Dashboard Functions
async function loadAdminDashboard() {
    await loadJudgesList();
    await loadTeamsList();
}

async function loadJudgesList() {
    try {
        let judges = [];
        
        if (db) {
            const judgesSnapshot = await db.collection('judges').get();
            judgesSnapshot.forEach(doc => {
                judges.push({ id: doc.id, ...doc.data() });
            });
        } else {
            judges = [...localData.judges];
        }
        
        const judgesList = document.getElementById('judges-list');
        if (judgesList) {
            judgesList.innerHTML = '';
            
            if (judges.length === 0) {
                judgesList.innerHTML = '<p>No judges found</p>';
                return;
            }
            
            judges.forEach(judge => {
                const judgeItem = document.createElement('div');
                judgeItem.className = 'judge-item';
                judgeItem.innerHTML = `
                    <div class="judge-info">
                        <strong>${judge.name}</strong>
                    </div>
                    <div class="judge-actions-small">
                        <button class="btn btn--small btn--outline" onclick="updateJudgePassword('${judge.id}', '${judge.name}')">Update Password</button>
                        <button class="btn btn--small" style="background: #E74C3C; color: white;" onclick="removeJudge('${judge.id}', '${judge.name}')">Remove</button>
                    </div>
                `;
                
                judgesList.appendChild(judgeItem);
            });
        }
    } catch (error) {
        console.error('Error loading judges:', error);
        showToast('Error loading judges', 'error');
    }
}

async function loadTeamsList() {
    try {
        let teams = [];
        
        if (db) {
            const teamsSnapshot = await db.collection('teams').get();
            teamsSnapshot.forEach(doc => {
                teams.push({ id: doc.id, ...doc.data() });
            });
        } else {
            teams = [...localData.teams];
        }
        
        const teamsList = document.getElementById('teams-list');
        if (teamsList) {
            teamsList.innerHTML = '';
            
            if (teams.length === 0) {
                teamsList.innerHTML = '<p>No teams found</p>';
                return;
            }
            
            teams.forEach(team => {
                const teamItem = document.createElement('div');
                teamItem.className = 'team-item';
                teamItem.innerHTML = `
                    <div class="team-info">
                        <strong>${team.name}</strong> (${team.id})
                    </div>
                `;
                
                teamsList.appendChild(teamItem);
            });
        }
    } catch (error) {
        console.error('Error loading teams:', error);
        showToast('Error loading teams', 'error');
    }
}

// Judge Management Functions
function showAddJudgeModal() {
    const modal = document.getElementById('add-judge-modal');
    const nameInput = document.getElementById('judge-name-input');
    
    if (modal) {
        modal.classList.remove('hidden');
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 100);
        }
    }
}

function hideAddJudgeModal() {
    const modal = document.getElementById('add-judge-modal');
    const form = document.getElementById('add-judge-form');
    
    if (modal) {
        modal.classList.add('hidden');
    }
    if (form) {
        form.reset();
    }
}

// Handle add judge form submission
async function handleAddJudge(e) {
    e.preventDefault();
    
    const name = document.getElementById('judge-name-input').value.trim();
    const password = document.getElementById('judge-password-input').value;
    
    if (!name || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const newJudge = { name, password };
        
        if (db) {
            const docRef = await db.collection('judges').add(newJudge);
            newJudge.id = docRef.id;
        } else {
            newJudge.id = 'judge_' + Date.now();
            localData.judges.push(newJudge);
        }
        
        hideAddJudgeModal();
        await loadJudgesList();
        showToast('Judge added successfully');
    } catch (error) {
        console.error('Error adding judge:', error);
        showToast('Error adding judge', 'error');
    }
    
    hideLoading();
}

async function updateJudgePassword(judgeId, judgeName) {
    const newPassword = prompt(`Enter new password for ${judgeName}:`);
    if (!newPassword) return;
    
    showLoading();
    
    try {
        if (db) {
            await db.collection('judges').doc(judgeId).update({
                password: newPassword
            });
        } else {
            const judgeIndex = localData.judges.findIndex(j => j.id === judgeId);
            if (judgeIndex !== -1) {
                localData.judges[judgeIndex].password = newPassword;
            }
        }
        
        showToast('Judge password updated successfully');
    } catch (error) {
        console.error('Error updating judge password:', error);
        showToast('Error updating judge password', 'error');
    }
    
    hideLoading();
}

async function removeJudge(judgeId, judgeName) {
    if (!confirm(`Are you sure you want to remove ${judgeName}?`)) return;
    
    showLoading();
    
    try {
        if (db) {
            await db.collection('judges').doc(judgeId).delete();
        } else {
            localData.judges = localData.judges.filter(j => j.id !== judgeId);
        }
        
        await loadJudgesList();
        showToast('Judge removed successfully');
    } catch (error) {
        console.error('Error removing judge:', error);
        showToast('Error removing judge', 'error');
    }
    
    hideLoading();
}

// Team Management Functions
async function handleTeamUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const teams = JSON.parse(event.target.result);
            if (!Array.isArray(teams)) {
                showToast('Invalid JSON format. Expected an array of teams.', 'error');
                return;
            }
            
            showLoading();
            
            for (const team of teams) {
                if (!team.id || !team.name) {
                    showToast('Invalid team format. Each team must have id and name.', 'error');
                    continue;
                }
                
                const newTeam = { id: team.id, name: team.name, scores: {} };
                
                if (db) {
                    await db.collection('teams').doc(team.id).set(newTeam);
                } else {
                    const existingIndex = localData.teams.findIndex(t => t.id === team.id);
                    if (existingIndex !== -1) {
                        localData.teams[existingIndex] = newTeam;
                    } else {
                        localData.teams.push(newTeam);
                    }
                }
            }
            
            await loadTeamsList();
            showToast(`${teams.length} teams uploaded successfully`);
        } catch (error) {
            console.error('Error uploading teams:', error);
            showToast('Error uploading teams. Please check the JSON format.', 'error');
        }
        
        hideLoading();
        e.target.value = '';
    };
    
    reader.readAsText(file);
}

// Leaderboard Functions
async function updateLeaderboard() {
    try {
        let teams = [];
        
        if (db) {
            const teamsSnapshot = await db.collection('teams').get();
            teamsSnapshot.forEach(doc => {
                teams.push({ id: doc.id, ...doc.data() });
            });
        } else {
            teams = [...localData.teams];
        }
        
        const leaderboardData = [];
        
        teams.forEach(team => {
            const scores = team.scores || {};
            
            if (Object.keys(scores).length === 0) return;
            
            let totalScore = 0;
            let judgeCount = 0;
            
            Object.values(scores).forEach(judgeScore => {
                totalScore += judgeScore.avgScore;
                judgeCount++;
            });
            
            const finalScore = judgeCount > 0 ? (totalScore / judgeCount) : 0;
            
            leaderboardData.push({
                teamId: team.id,
                teamName: team.name,
                finalScore: parseFloat(finalScore.toFixed(2))
            });
        });
        
        if (db) {
            const batch = db.batch();
            leaderboardData.forEach(data => {
                const leaderboardRef = db.collection('leaderboard').doc(data.teamId);
                batch.set(leaderboardRef, {
                    teamName: data.teamName,
                    finalScore: data.finalScore
                });
            });
            await batch.commit();
        } else {
            localData.leaderboard = leaderboardData;
        }
    } catch (error) {
        console.error('Error updating leaderboard:', error);
    }
}

async function showLeaderboard() {
    showPage('leaderboard-page');
    await loadLeaderboard();
}

async function loadLeaderboard() {
    try {
        let leaderboardData = [];
        
        if (db) {
            const leaderboardSnapshot = await db.collection('leaderboard').orderBy('finalScore', 'desc').get();
            leaderboardSnapshot.forEach(doc => {
                leaderboardData.push({ id: doc.id, ...doc.data() });
            });
        } else {
            leaderboardData = [...localData.leaderboard].sort((a, b) => b.finalScore - a.finalScore);
        }
        
        const leaderboardTable = document.getElementById('leaderboard-table');
        if (leaderboardTable) {
            if (leaderboardData.length === 0) {
                leaderboardTable.innerHTML = '<p class="text-center p-16">No scores available yet</p>';
                return;
            }
            
            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Team Name</th>
                            <th>Final Score</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            leaderboardData.forEach((data, index) => {
                const rank = index + 1;
                const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
                
                tableHTML += `
                    <tr>
                        <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                        <td>${data.teamName}</td>
                        <td>${data.finalScore.toFixed(2)}</td>
                    </tr>
                `;
            });
            
            tableHTML += '</tbody></table>';
            leaderboardTable.innerHTML = tableHTML;
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        showToast('Error loading leaderboard', 'error');
    }
}

async function downloadLeaderboardCSV() {
    try {
        let leaderboardData = [];
        
        if (db) {
            const leaderboardSnapshot = await db.collection('leaderboard').orderBy('finalScore', 'desc').get();
            leaderboardSnapshot.forEach(doc => {
                leaderboardData.push(doc.data());
            });
        } else {
            leaderboardData = [...localData.leaderboard].sort((a, b) => b.finalScore - a.finalScore);
        }
        
        if (leaderboardData.length === 0) {
            showToast('No data available for download', 'warning');
            return;
        }
        
        let csvContent = 'Rank,Team Name,Final Score\n';
        
        leaderboardData.forEach((data, index) => {
            const rank = index + 1;
            csvContent += `${rank},${data.teamName},${data.finalScore.toFixed(2)}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'leaderboard.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        
        showToast('Leaderboard downloaded successfully');
    } catch (error) {
        console.error('Error downloading leaderboard:', error);
        showToast('Error downloading leaderboard', 'error');
    }
}

async function resetAllData() {
    if (!confirm('Are you sure you want to reset all scores? This action cannot be undone.')) return;
    
    showLoading();
    
    try {
        if (db) {
            // Clear all scores from teams
            const teamsSnapshot = await db.collection('teams').get();
            const batch = db.batch();
            
            teamsSnapshot.forEach(doc => {
                batch.update(doc.ref, { scores: {} });
            });
            
            await batch.commit();
            
            // Clear leaderboard
            const leaderboardSnapshot = await db.collection('leaderboard').get();
            const deleteBatch = db.batch();
            
            leaderboardSnapshot.forEach(doc => {
                deleteBatch.delete(doc.ref);
            });
            
            await deleteBatch.commit();
        } else {
            // Reset local data
            localData.teams.forEach(team => {
                team.scores = {};
            });
            localData.leaderboard = [];
        }
        
        await loadTeamsList();
        showToast('All data reset successfully');
    } catch (error) {
        console.error('Error resetting data:', error);
        showToast('Error resetting data', 'error');
    }
    
    hideLoading();
}

// Navigation Functions
function backToAdmin() {
    showPage('admin-dashboard');
}

function logout() {
    currentUser = null;
    currentUserType = null;
    currentTeam = null;
    showPage('landing-page');
    showToast('Logged out successfully');
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('Initializing application...');
        
        // Initialize Firebase (will fallback to local data if fails)
        await initializeFirebase();
        
        // Set up form event listeners
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
        
        const scoringForm = document.getElementById('scoring-form');
        if (scoringForm) {
            scoringForm.addEventListener('submit', handleScoring);
        }
        
        const addJudgeForm = document.getElementById('add-judge-form');
        if (addJudgeForm) {
            addJudgeForm.addEventListener('submit', handleAddJudge);
        }
        
        const teamFile = document.getElementById('team-file');
        if (teamFile) {
            teamFile.addEventListener('change', handleTeamUpload);
        }
        
        // Set up scoring input listeners for average calculation
        const scoringInputs = ['uniqueness', 'presentation', 'workingModel', 'impactFuture', 'scalability'];
        scoringInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', updateAverageScore);
            }
        });
        
        // Set up modal event listeners
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                if (e.target.id === 'login-modal') hideLoginModal();
                if (e.target.id === 'add-judge-modal') hideAddJudgeModal();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const loginModal = document.getElementById('login-modal');
                const addJudgeModal = document.getElementById('add-judge-modal');
                
                if (loginModal && !loginModal.classList.contains('hidden')) {
                    hideLoginModal();
                }
                if (addJudgeModal && !addJudgeModal.classList.contains('hidden')) {
                    hideAddJudgeModal();
                }
            }
        });
        
        console.log('Application initialized successfully');
        showToast('Application ready', 'success');
    } catch (error) {
        console.error('Error initializing application:', error);
        showToast('Application initialized with limited functionality', 'warning');
    }
});
