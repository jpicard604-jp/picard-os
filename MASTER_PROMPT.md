Read CLAUDE.md first.

I want to build the first MVP of Picard OS / Jpicky.

This is a private web-based personal operating system for Jackson Picard. It should work on Windows, MacBook browsers, iPhone Safari, and Android Chrome. It should feel like a real app on mobile, but it is not going to the App Store. It should be installable as a PWA / Add to Home Screen web app.

The app combines:
- fitness
- nutrition
- recovery
- daily goals
- projects/ventures
- identity metrics
- screen time
- smoking/alcohol streaks
- upload center for screenshots/photos
- voice log/dictation
- medications/nootropics/peptides tracking
- personal training
- subscriptions/net worth later
- WHOOP later
- MyFitnessPal screenshot/CSV import later
- Apple Health/iPhone Shortcut import later

IMPORTANT COST RULE:
The app should be basically free to operate.

Use free/low-cost tools first:
- local mock data first
- Vercel free tier for hosting later
- Supabase free tier for database/auth/storage later
- rule-based AI logic first
- paid AI API calls only as optional future upgrades

Do not depend on paid APIs for the MVP.
Do not depend on the MyFitnessPal API.
Do not depend on Apple HealthKit.
Do not require native iOS development.
Do not require Mac-only setup.

I am a Windows user, but the final website should also work on Mac and mobile browsers.

TECH STACK:
- Next.js App Router
- TypeScript
- Tailwind CSS
- Recharts for charts
- PWA support
- Supabase later, not required for first mock-data version

VISUAL STYLE:
Premium neon blue / black theme:
- black or near-black background
- electric/neon blue accents
- silver and white text
- subtle blue glow
- glassmorphism cards
- clean performance dashboard
- luxury founder cockpit feel
- inspired by WHOOP, Porsche, Apple Fitness, and premium SaaS
- not childish
- not overly gamer-looking
- not crypto-looking
- not cheesy

APP LAYOUT:
The app should be responsive:
- desktop optimized for Windows/Mac browsers
- mobile optimized for iPhone/Android
- bottom navigation on mobile
- sidebar or top navigation on desktop
- thumb-friendly mobile buttons
- large readable cards
- fast loading
- clean spacing

PWA REQUIREMENTS:
Make the app installable to phone home screen:
- manifest file
- app name: Picard OS
- short name: Jpicky
- theme color: neon blue / black
- app icon placeholder
- mobile viewport setup
- works well in iPhone Safari and Android Chrome

AI COACH:
The AI coach is called XODUS.

XODUS should be:
- direct
- intelligent
- calm but intense
- honest
- not cringe
- not fake motivational
- not corny

Good XODUS example:
"Recovery is low, and Instagram time is high. Today is about control. Hit protein, move clean, and finish one task for PLAY before you let the day disappear."

Bad XODUS example:
"Rise and grind, beast mode activated."

For the MVP, make XODUS rule-based, not API-based.

It should generate messages from mock/current data using conditions like:
- low sleep
- low recovery
- missed protein
- high screen time
- overdue project task
- smoked today
- did not train
- did not move a project forward
- inconsistent supplement or medication routine
- poor hydration
- low confidence metrics

CURRENT PROJECTS / VENTURES:
Use these initial projects:
1. PLAY Productions for Graton Casino
2. Wine Room
3. Ashes and Snow, planned for June/July
4. Personal Training
5. Social Confidence / Instagram Improvement

Do not include X-POSE as a current project unless I add it later.

CORE MODULES:
1. Today / Daily Command Center
2. XODUS daily message
3. Fitness dashboard
4. Macro and hydration tracker
5. Progressive overload tracker
6. Projects and Ventures dashboard
7. Identity Metrics
8. Screen Time tracker
9. Smoking/alcohol streak tracker
10. Upload Center
11. Voice Log / Dictation
12. Medication / Nootropics / Peptides tracker
13. Subscriptions and net worth placeholder for later
14. WHOOP placeholder for later

DAILY COMMAND CENTER:
Show:
- today’s execution score
- today’s mission
- top 3 priorities
- fitness status
- nutrition status
- screen time status
- project urgency
- XODUS message

FITNESS / NUTRITION:
Track:
- bodyweight
- calories eaten
- calorie target
- protein eaten
- protein target
- carbs
- fat
- water
- sleep
- recovery score placeholder
- workout planned
- workout completed
- steps
- running/cardio

PROGRESSIVE OVERLOAD:
Track:
- exercise
- previous weight/reps
- target weight/reps
- performance trend
- next recommendation

Start with:
- bench press
- incline bench
- weighted pull-up
- shoulder press
- leg press or squat
- RDL
- run distance/time

IDENTITY METRICS:
Track:
- trained today
- hit protein
- hit water
- took photos
- posted or improved Instagram
- smoked today
- drank alcohol today
- confidence score 1-10
- grooming/skincare completed
- supplements taken
- social exposure/action

SCREEN TIME:
Track:
- total screen time
- Instagram time
- TikTok time
- productive app time
- notes

SMOKING / ALCOHOL:
Track:
- smoked today yes/no
- drank alcohol today yes/no
- current no-smoking streak
- current alcohol-free streak
- notes

MEDICATION / NOOTROPICS / PEPTIDES:
Create a structured tracker for:
- medications
- supplements
- nootropics
- peptides
- vitamins
- hydration/electrolytes
- caffeine intake

The tracker should support:
- compound name
- category
- dosage
- timing
- frequency
- taken today yes/no
- notes
- optional mood/performance impact notes

Examples:
- creatine
- magnesium
- electrolytes
- caffeine
- vitamin D
- protein powder
- peptides
- prescribed medications
- focus nootropics

Do not make medical claims.
Do not provide unsafe dosing advice.
This is strictly a tracking/logging system.

XODUS can reference consistency patterns like:
- missed supplement routines
- inconsistent sleep support habits
- excessive caffeine
- hydration problems

UPLOAD CENTER:
I want to upload images from my phone or computer.

Supported upload types:
- MyFitnessPal daily nutrition screenshot
- Apple Screen Time screenshot
- progress photo
- scale/bodyweight screenshot
- workout screenshot
- supplement stack photo
- medication schedule screenshot
- other fitness/health screenshot

MVP behavior:
- upload image
- select upload type
- show preview
- show uploaded time
- show status: "Ready for XODUS review"
- store temporarily in local state or mock data for now
- create placeholder parser functions for future OCR/AI extraction

Do not add expensive OCR yet.
Do not add real AI image parsing yet.
Just create the structure so we can add it later.

VOICE LOG / DICTATION:
Add a Voice Log feature so I can talk instead of typing everything manually.

I want to be able to open the app, press a button, and dictate what happened today.

Example voice input:
"I benched 275 for 6, hit 180 grams of protein, had 2300 calories, worked on the Wine Room deck, didn’t smoke, screen time was high, took creatine and magnesium, and I felt tired."

MVP behavior:
- create a Voice Log section
- add a large "Start Voice Log" button
- use browser speech recognition if available
- show live transcript text
- allow me to edit the transcript manually
- save the transcript to local/mock state
- show status: "Ready for XODUS review"
- create a placeholder function called parseVoiceLog()

parseVoiceLog should later extract structured data like:
- workout completed
- exercises/sets/reps/weight
- calories
- protein
- water
- sleep
- screen time
- Instagram time
- smoked today
- drank today
- project progress
- medications/supplements/nootropics taken
- mood/energy
- notes

Do not add paid AI transcription yet.
Do not require native mobile development.
Use free browser-based dictation first.

Important:
The feature should work as a progressive enhancement. If browser speech recognition is not supported, show a manual text box where I can type or paste a voice note transcript.

PROJECTS / VENTURES:
Each project should have:
- name
- status
- priority
- next action
- target date/month
- progress percentage
- notes
- last updated
- optional revenue potential

Use realistic mock data.

DATA:
Create clean TypeScript types and mock data files for:
- user profile
- daily log
- fitness metrics
- nutrition
- workouts
- exercises
- projects
- identity metrics
- screen time
- uploads
- streaks
- voice logs
- supplement/medication tracking
- XODUS context

CODE QUALITY:
Use:
- clean reusable components
- clear folder structure
- small components
- clean calculation functions
- mock data separated from UI
- responsive design
- good TypeScript types

Avoid:
- huge files
- messy inline logic
- overbuilding
- unnecessary packages
- fake API integrations
- paid services in the MVP

FIRST BUILD:
Build the MVP with mock data.

Create:
- responsive dashboard layout
- desktop navigation
- mobile bottom navigation
- PWA setup
- XODUS rule-based message card
- Upload Center with image preview
- Voice Log / Dictation section
- Medication/Nootropics/Peptides tracker
- reusable dashboard cards
- mock data
- TypeScript types
- basic charts where useful

After building, explain:
1. what files were created
2. how to run the app
3. how to test it on desktop
4. how to add it to phone home screen
5. what we should build next
