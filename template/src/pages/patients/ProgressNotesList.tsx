import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import axios from 'axios';
import CommonFooter from '../../components/common-footer/commonFooter';
import AutoBreadcrumb from '../../components/breadcrumb/AutoBreadcrumb';
import config from '../../config';


const API_URL = config.apiUrl;
const LOCATION_ID = config.ghlLocationId;

// ICD-10 Mental Health Diagnosis Codes
const ICD10_DIAGNOSES = [
  // Depressive Disorders
  { code: 'F32.0', description: 'Major depressive disorder, single episode, mild' },
  { code: 'F32.1', description: 'Major depressive disorder, single episode, moderate' },
  { code: 'F32.2', description: 'Major depressive disorder, single episode, severe without psychotic features' },
  { code: 'F32.3', description: 'Major depressive disorder, single episode, severe with psychotic features' },
  { code: 'F32.4', description: 'Major depressive disorder, single episode, in partial remission' },
  { code: 'F32.5', description: 'Major depressive disorder, single episode, in full remission' },
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified' },
  { code: 'F33.0', description: 'Major depressive disorder, recurrent, mild' },
  { code: 'F33.1', description: 'Major depressive disorder, recurrent, moderate' },
  { code: 'F33.2', description: 'Major depressive disorder, recurrent, severe without psychotic features' },
  { code: 'F33.3', description: 'Major depressive disorder, recurrent, severe with psychotic features' },
  { code: 'F33.41', description: 'Major depressive disorder, recurrent, in partial remission' },
  { code: 'F33.42', description: 'Major depressive disorder, recurrent, in full remission' },
  { code: 'F34.1', description: 'Dysthymic disorder (Persistent depressive disorder)' },
  { code: 'F34.81', description: 'Disruptive mood dysregulation disorder' },
  
  // Anxiety Disorders
  { code: 'F40.10', description: 'Social anxiety disorder (Social phobia), unspecified' },
  { code: 'F40.11', description: 'Social anxiety disorder, generalized' },
  { code: 'F40.00', description: 'Agoraphobia, unspecified' },
  { code: 'F40.01', description: 'Agoraphobia with panic disorder' },
  { code: 'F40.02', description: 'Agoraphobia without panic disorder' },
  { code: 'F40.210', description: 'Arachnophobia' },
  { code: 'F40.218', description: 'Other animal type phobia' },
  { code: 'F40.230', description: 'Fear of blood' },
  { code: 'F40.231', description: 'Fear of injections and transfusions' },
  { code: 'F40.232', description: 'Fear of other medical care' },
  { code: 'F40.233', description: 'Fear of injury' },
  { code: 'F40.240', description: 'Claustrophobia' },
  { code: 'F40.241', description: 'Acrophobia' },
  { code: 'F40.248', description: 'Other situational type phobia' },
  { code: 'F40.290', description: 'Androphobia' },
  { code: 'F40.291', description: 'Gynephobia' },
  { code: 'F40.298', description: 'Other specified phobia' },
  { code: 'F40.8', description: 'Other phobic anxiety disorders' },
  { code: 'F40.9', description: 'Phobic anxiety disorder, unspecified' },
  { code: 'F41.0', description: 'Panic disorder without agoraphobia' },
  { code: 'F41.1', description: 'Generalized anxiety disorder' },
  { code: 'F41.3', description: 'Other mixed anxiety disorders' },
  { code: 'F41.8', description: 'Other specified anxiety disorders' },
  { code: 'F41.9', description: 'Anxiety disorder, unspecified' },
  
  // Trauma and Stressor-Related Disorders
  { code: 'F43.0', description: 'Acute stress reaction' },
  { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified' },
  { code: 'F43.11', description: 'Post-traumatic stress disorder, acute' },
  { code: 'F43.12', description: 'Post-traumatic stress disorder, chronic' },
  { code: 'F43.20', description: 'Adjustment disorder, unspecified' },
  { code: 'F43.21', description: 'Adjustment disorder with depressed mood' },
  { code: 'F43.22', description: 'Adjustment disorder with anxiety' },
  { code: 'F43.23', description: 'Adjustment disorder with mixed anxiety and depressed mood' },
  { code: 'F43.24', description: 'Adjustment disorder with disturbance of conduct' },
  { code: 'F43.25', description: 'Adjustment disorder with mixed disturbance of emotions and conduct' },
  { code: 'F43.29', description: 'Adjustment disorder with other symptoms' },
  
  // OCD and Related Disorders
  { code: 'F42.2', description: 'Mixed obsessional thoughts and acts' },
  { code: 'F42.3', description: 'Hoarding disorder' },
  { code: 'F42.4', description: 'Excoriation (skin-picking) disorder' },
  { code: 'F42.8', description: 'Other obsessive-compulsive disorder' },
  { code: 'F42.9', description: 'Obsessive-compulsive disorder, unspecified' },
  { code: 'F45.22', description: 'Body dysmorphic disorder' },
  
  // Bipolar and Related Disorders
  { code: 'F31.0', description: 'Bipolar disorder, current episode hypomanic' },
  { code: 'F31.10', description: 'Bipolar disorder, current episode manic without psychotic features, unspecified' },
  { code: 'F31.11', description: 'Bipolar disorder, current episode manic without psychotic features, mild' },
  { code: 'F31.12', description: 'Bipolar disorder, current episode manic without psychotic features, moderate' },
  { code: 'F31.13', description: 'Bipolar disorder, current episode manic without psychotic features, severe' },
  { code: 'F31.2', description: 'Bipolar disorder, current episode manic severe with psychotic features' },
  { code: 'F31.30', description: 'Bipolar disorder, current episode depressed, mild or moderate severity, unspecified' },
  { code: 'F31.31', description: 'Bipolar disorder, current episode depressed, mild' },
  { code: 'F31.32', description: 'Bipolar disorder, current episode depressed, moderate' },
  { code: 'F31.4', description: 'Bipolar disorder, current episode depressed, severe, without psychotic features' },
  { code: 'F31.5', description: 'Bipolar disorder, current episode depressed, severe, with psychotic features' },
  { code: 'F31.60', description: 'Bipolar disorder, current episode mixed, unspecified' },
  { code: 'F31.61', description: 'Bipolar disorder, current episode mixed, mild' },
  { code: 'F31.62', description: 'Bipolar disorder, current episode mixed, moderate' },
  { code: 'F31.63', description: 'Bipolar disorder, current episode mixed, severe, without psychotic features' },
  { code: 'F31.64', description: 'Bipolar disorder, current episode mixed, severe, with psychotic features' },
  { code: 'F31.70', description: 'Bipolar disorder, currently in remission, most recent episode unspecified' },
  { code: 'F31.71', description: 'Bipolar disorder, in partial remission, most recent episode hypomanic' },
  { code: 'F31.72', description: 'Bipolar disorder, in full remission, most recent episode hypomanic' },
  { code: 'F31.73', description: 'Bipolar disorder, in partial remission, most recent episode manic' },
  { code: 'F31.74', description: 'Bipolar disorder, in full remission, most recent episode manic' },
  { code: 'F31.75', description: 'Bipolar disorder, in partial remission, most recent episode depressed' },
  { code: 'F31.76', description: 'Bipolar disorder, in full remission, most recent episode depressed' },
  { code: 'F31.77', description: 'Bipolar disorder, in partial remission, most recent episode mixed' },
  { code: 'F31.78', description: 'Bipolar disorder, in full remission, most recent episode mixed' },
  { code: 'F31.81', description: 'Bipolar II disorder' },
  { code: 'F31.89', description: 'Other bipolar disorder' },
  { code: 'F31.9', description: 'Bipolar disorder, unspecified' },
  { code: 'F34.0', description: 'Cyclothymic disorder' },
  
  // Schizophrenia Spectrum
  { code: 'F20.0', description: 'Paranoid schizophrenia' },
  { code: 'F20.1', description: 'Disorganized schizophrenia' },
  { code: 'F20.2', description: 'Catatonic schizophrenia' },
  { code: 'F20.3', description: 'Undifferentiated schizophrenia' },
  { code: 'F20.5', description: 'Residual schizophrenia' },
  { code: 'F20.81', description: 'Schizophreniform disorder' },
  { code: 'F20.89', description: 'Other schizophrenia' },
  { code: 'F20.9', description: 'Schizophrenia, unspecified' },
  { code: 'F21', description: 'Schizotypal disorder' },
  { code: 'F22', description: 'Delusional disorders' },
  { code: 'F23', description: 'Brief psychotic disorder' },
  { code: 'F25.0', description: 'Schizoaffective disorder, bipolar type' },
  { code: 'F25.1', description: 'Schizoaffective disorder, depressive type' },
  { code: 'F25.8', description: 'Other schizoaffective disorders' },
  { code: 'F25.9', description: 'Schizoaffective disorder, unspecified' },
  
  // Eating Disorders
  { code: 'F50.00', description: 'Anorexia nervosa, unspecified' },
  { code: 'F50.01', description: 'Anorexia nervosa, restricting type' },
  { code: 'F50.02', description: 'Anorexia nervosa, binge eating/purging type' },
  { code: 'F50.2', description: 'Bulimia nervosa' },
  { code: 'F50.81', description: 'Binge eating disorder' },
  { code: 'F50.82', description: 'Avoidant/restrictive food intake disorder' },
  { code: 'F50.89', description: 'Other specified eating disorder' },
  { code: 'F50.9', description: 'Eating disorder, unspecified' },
  
  // Substance Use Disorders
  { code: 'F10.10', description: 'Alcohol use disorder, mild' },
  { code: 'F10.20', description: 'Alcohol use disorder, moderate' },
  { code: 'F10.21', description: 'Alcohol use disorder, moderate, in remission' },
  { code: 'F10.229', description: 'Alcohol dependence with intoxication, unspecified' },
  { code: 'F10.239', description: 'Alcohol dependence with withdrawal, unspecified' },
  { code: 'F11.10', description: 'Opioid use disorder, mild' },
  { code: 'F11.20', description: 'Opioid use disorder, moderate' },
  { code: 'F11.21', description: 'Opioid use disorder, moderate, in remission' },
  { code: 'F12.10', description: 'Cannabis use disorder, mild' },
  { code: 'F12.20', description: 'Cannabis use disorder, moderate' },
  { code: 'F12.21', description: 'Cannabis use disorder, moderate, in remission' },
  { code: 'F13.10', description: 'Sedative, hypnotic or anxiolytic use disorder, mild' },
  { code: 'F13.20', description: 'Sedative, hypnotic or anxiolytic use disorder, moderate' },
  { code: 'F14.10', description: 'Cocaine use disorder, mild' },
  { code: 'F14.20', description: 'Cocaine use disorder, moderate' },
  { code: 'F15.10', description: 'Other stimulant use disorder, mild' },
  { code: 'F15.20', description: 'Other stimulant use disorder, moderate' },
  
  // Personality Disorders
  { code: 'F60.0', description: 'Paranoid personality disorder' },
  { code: 'F60.1', description: 'Schizoid personality disorder' },
  { code: 'F60.2', description: 'Antisocial personality disorder' },
  { code: 'F60.3', description: 'Borderline personality disorder' },
  { code: 'F60.4', description: 'Histrionic personality disorder' },
  { code: 'F60.5', description: 'Obsessive-compulsive personality disorder' },
  { code: 'F60.6', description: 'Avoidant personality disorder' },
  { code: 'F60.7', description: 'Dependent personality disorder' },
  { code: 'F60.81', description: 'Narcissistic personality disorder' },
  { code: 'F60.89', description: 'Other specific personality disorders' },
  { code: 'F60.9', description: 'Personality disorder, unspecified' },
  
  // ADHD
  { code: 'F90.0', description: 'Attention-deficit hyperactivity disorder, predominantly inattentive type' },
  { code: 'F90.1', description: 'Attention-deficit hyperactivity disorder, predominantly hyperactive type' },
  { code: 'F90.2', description: 'Attention-deficit hyperactivity disorder, combined type' },
  { code: 'F90.8', description: 'Attention-deficit hyperactivity disorder, other type' },
  { code: 'F90.9', description: 'Attention-deficit hyperactivity disorder, unspecified type' },
  
  // Sleep Disorders
  { code: 'F51.01', description: 'Primary insomnia' },
  { code: 'F51.02', description: 'Adjustment insomnia' },
  { code: 'F51.03', description: 'Paradoxical insomnia' },
  { code: 'F51.04', description: 'Psychophysiologic insomnia' },
  { code: 'F51.05', description: 'Insomnia due to other mental disorder' },
  { code: 'F51.09', description: 'Other insomnia not due to a substance or known physiological condition' },
  { code: 'F51.11', description: 'Primary hypersomnia' },
  { code: 'F51.12', description: 'Insufficient sleep syndrome' },
  { code: 'F51.13', description: 'Hypersomnia due to other mental disorder' },
  { code: 'F51.3', description: 'Sleepwalking [somnambulism]' },
  { code: 'F51.4', description: 'Sleep terrors [night terrors]' },
  { code: 'F51.5', description: 'Nightmare disorder' },
  
  // Other
  { code: 'F45.1', description: 'Undifferentiated somatoform disorder' },
  { code: 'F45.21', description: 'Illness anxiety disorder' },
  { code: 'F44.0', description: 'Dissociative amnesia' },
  { code: 'F44.1', description: 'Dissociative fugue' },
  { code: 'F44.81', description: 'Dissociative identity disorder' },
  { code: 'F44.89', description: 'Other dissociative and conversion disorders' },
  { code: 'F44.9', description: 'Dissociative and conversion disorder, unspecified' },
  { code: 'F63.0', description: 'Pathological gambling' },
  { code: 'F63.1', description: 'Pyromania' },
  { code: 'F63.2', description: 'Kleptomania' },
  { code: 'F63.3', description: 'Trichotillomania' },
  { code: 'F63.81', description: 'Intermittent explosive disorder' },
  { code: 'F91.1', description: 'Conduct disorder, childhood-onset type' },
  { code: 'F91.2', description: 'Conduct disorder, adolescent-onset type' },
  { code: 'F91.3', description: 'Oppositional defiant disorder' },
  { code: 'F91.9', description: 'Conduct disorder, unspecified' },
  { code: 'F93.0', description: 'Separation anxiety disorder of childhood' },
  { code: 'F94.0', description: 'Selective mutism' },
  { code: 'F94.1', description: 'Reactive attachment disorder of childhood' },
  { code: 'F94.2', description: 'Disinhibited attachment disorder of childhood' },
  { code: 'R45.851', description: 'Suicidal ideations' },
  { code: 'Z91.5', description: 'Personal history of self-harm' },
];

// Wiley-style Treatment Plan Data
const TREATMENT_PLAN_DATA: { [key: string]: any } = {
  depression: {
    label: 'Depression',
    behavioralDefinitions: [
      'Depressed mood most of the day, nearly every day',
      'Diminished interest or pleasure in activities',
      'Significant weight loss or gain (more than 5% in a month)',
      'Insomnia or hypersomnia nearly every day',
      'Psychomotor agitation or retardation',
      'Fatigue or loss of energy nearly every day',
      'Feelings of worthlessness or excessive guilt',
      'Diminished ability to think or concentrate',
      'Recurrent thoughts of death or suicidal ideation',
      'Social withdrawal and isolation',
      'Neglect of personal hygiene and appearance',
      'Difficulty completing daily tasks and responsibilities'
    ],
    longTermGoals: [
      'Alleviate depressed mood and return to previous level of functioning',
      'Develop healthy cognitive patterns and beliefs about self and the world',
      'Develop and implement effective coping strategies for managing mood',
      'Improve social functioning and interpersonal relationships',
      'Return to previous level of occupational/academic functioning'
    ],
    shortTermObjectives: [
      { objective: 'Identify and express feelings related to depression', timeframe: '2 weeks' },
      { objective: 'Learn and implement at least 3 coping strategies for low mood', timeframe: '4 weeks' },
      { objective: 'Engage in at least 3 pleasurable activities per week', timeframe: '3 weeks' },
      { objective: 'Challenge and replace negative automatic thoughts', timeframe: '6 weeks' },
      { objective: 'Establish regular sleep schedule (consistent bed/wake times)', timeframe: '2 weeks' },
      { objective: 'Increase physical activity to 30 minutes, 3 times per week', timeframe: '4 weeks' },
      { objective: 'Attend at least 2 social activities per week', timeframe: '4 weeks' },
      { objective: 'Complete daily mood tracking journal', timeframe: '1 week' },
      { objective: 'Reduce hopeless thoughts from daily to weekly occurrence', timeframe: '8 weeks' }
    ],
    interventions: [
      'Cognitive Behavioral Therapy (CBT) to identify and modify negative thought patterns',
      'Behavioral Activation to increase engagement in rewarding activities',
      'Psychoeducation about depression, its causes, and treatment options',
      'Teach and practice relaxation techniques (deep breathing, progressive muscle relaxation)',
      'Develop a daily activity schedule to structure time and increase accomplishment',
      'Assign homework to practice cognitive restructuring between sessions',
      'Explore underlying issues contributing to depression',
      'Coordinate with psychiatrist for medication evaluation if indicated',
      'Teach sleep hygiene strategies to improve sleep quality',
      'Use motivational interviewing to enhance engagement in treatment',
      'Develop a safety plan if suicidal ideation is present',
      'Process grief and loss issues as they relate to depression'
    ]
  },
  anxiety: {
    label: 'Anxiety',
    behavioralDefinitions: [
      'Excessive worry occurring more days than not',
      'Difficulty controlling worry',
      'Restlessness or feeling keyed up or on edge',
      'Easily fatigued',
      'Difficulty concentrating or mind going blank',
      'Irritability',
      'Muscle tension',
      'Sleep disturbance',
      'Avoidance of anxiety-provoking situations',
      'Physical symptoms (racing heart, sweating, trembling)',
      'Panic attacks',
      'Anticipatory anxiety about future events'
    ],
    longTermGoals: [
      'Reduce overall level of anxiety to manageable levels',
      'Eliminate panic attacks or reduce their frequency and intensity',
      'Develop effective coping mechanisms for managing anxiety',
      'Reduce avoidance behaviors and increase engagement in previously avoided activities',
      'Return to normal daily functioning without significant impairment from anxiety'
    ],
    shortTermObjectives: [
      { objective: 'Learn and demonstrate deep breathing techniques', timeframe: '1 week' },
      { objective: 'Identify triggers that increase anxiety', timeframe: '2 weeks' },
      { objective: 'Practice progressive muscle relaxation daily', timeframe: '2 weeks' },
      { objective: 'Create and use a worry time to contain anxious thoughts', timeframe: '3 weeks' },
      { objective: 'Face at least 2 avoided situations per week', timeframe: '4 weeks' },
      { objective: 'Reduce panic attack frequency by 50%', timeframe: '8 weeks' },
      { objective: 'Decrease safety behaviors by 75%', timeframe: '6 weeks' },
      { objective: 'Challenge catastrophic thinking patterns', timeframe: '4 weeks' },
      { objective: 'Implement grounding techniques when feeling overwhelmed', timeframe: '2 weeks' }
    ],
    interventions: [
      'Cognitive Behavioral Therapy (CBT) focusing on anxiety-specific cognitive distortions',
      'Exposure therapy using systematic desensitization or graduated exposure',
      'Teach diaphragmatic breathing and relaxation techniques',
      'Psychoeducation about the nature of anxiety and the fight-or-flight response',
      'Develop a fear hierarchy for exposure work',
      'Cognitive restructuring to challenge anxious predictions',
      'Interoceptive exposure for panic symptoms',
      'Mindfulness-based interventions to increase present-moment awareness',
      'Coordinate with psychiatrist for medication evaluation if indicated',
      'Assign between-session exposure homework',
      'Process underlying fears and concerns',
      'Teach worry management strategies (worry time, problem-solving)'
    ]
  },
  trauma: {
    label: 'Trauma / PTSD',
    behavioralDefinitions: [
      'Intrusive memories or flashbacks of traumatic event',
      'Nightmares related to the trauma',
      'Intense psychological distress at exposure to trauma cues',
      'Avoidance of thoughts, feelings, or reminders of the trauma',
      'Negative alterations in cognitions (blame, guilt, shame)',
      'Persistent negative emotional state',
      'Diminished interest in significant activities',
      'Feelings of detachment from others',
      'Hypervigilance and exaggerated startle response',
      'Difficulty concentrating',
      'Sleep disturbance',
      'Irritability or angry outbursts'
    ],
    longTermGoals: [
      'Process traumatic memories and reduce their emotional intensity',
      'Reduce or eliminate PTSD symptoms',
      'Develop effective coping strategies for trauma-related distress',
      'Restore sense of safety and trust in self and others',
      'Return to previous level of functioning and engagement in life'
    ],
    shortTermObjectives: [
      { objective: 'Establish safety and stabilization', timeframe: '2 weeks' },
      { objective: 'Learn and practice grounding techniques', timeframe: '1 week' },
      { objective: 'Develop a trauma narrative', timeframe: '8 weeks' },
      { objective: 'Reduce avoidance of trauma reminders by 50%', timeframe: '6 weeks' },
      { objective: 'Decrease frequency of nightmares', timeframe: '8 weeks' },
      { objective: 'Identify and challenge trauma-related cognitive distortions', timeframe: '6 weeks' },
      { objective: 'Increase engagement in social activities', timeframe: '4 weeks' },
      { objective: 'Develop and utilize a self-care routine', timeframe: '2 weeks' },
      { objective: 'Reduce hypervigilance symptoms', timeframe: '10 weeks' }
    ],
    interventions: [
      'Trauma-Focused Cognitive Behavioral Therapy (TF-CBT)',
      'EMDR (Eye Movement Desensitization and Reprocessing)',
      'Prolonged Exposure Therapy',
      'Cognitive Processing Therapy (CPT)',
      'Psychoeducation about trauma and PTSD',
      'Teach grounding and containment strategies',
      'Process traumatic memories in a safe therapeutic environment',
      'Address trauma-related guilt and shame',
      'Develop a safety plan',
      'Coordinate with psychiatrist for medication evaluation',
      'Teach sleep hygiene and nightmare management strategies',
      'Build coping skills for managing triggers and flashbacks'
    ]
  },
  substanceUse: {
    label: 'Substance Use',
    behavioralDefinitions: [
      'Use of substances in larger amounts or over longer period than intended',
      'Persistent desire or unsuccessful efforts to cut down',
      'Great deal of time spent obtaining, using, or recovering from substances',
      'Craving or strong urge to use substances',
      'Failure to fulfill major role obligations',
      'Continued use despite social or interpersonal problems',
      'Important activities given up or reduced',
      'Use in physically hazardous situations',
      'Continued use despite physical or psychological problems',
      'Tolerance (need for increased amounts)',
      'Withdrawal symptoms when not using'
    ],
    longTermGoals: [
      'Achieve and maintain abstinence from substances',
      'Develop healthy coping mechanisms to replace substance use',
      'Improve overall quality of life and relationships',
      'Address underlying issues contributing to substance use',
      'Establish a strong recovery support network'
    ],
    shortTermObjectives: [
      { objective: 'Complete detoxification safely if needed', timeframe: '1-2 weeks' },
      { objective: 'Identify triggers for substance use', timeframe: '2 weeks' },
      { objective: 'Develop a relapse prevention plan', timeframe: '4 weeks' },
      { objective: 'Attend 3 support group meetings per week', timeframe: '1 week' },
      { objective: 'Learn and practice 5 coping skills for cravings', timeframe: '3 weeks' },
      { objective: 'Identify and address 3 high-risk situations', timeframe: '4 weeks' },
      { objective: 'Establish a sober support network', timeframe: '6 weeks' },
      { objective: 'Address co-occurring mental health issues', timeframe: '8 weeks' },
      { objective: 'Develop healthy lifestyle habits (sleep, nutrition, exercise)', timeframe: '6 weeks' }
    ],
    interventions: [
      'Motivational Interviewing to enhance readiness for change',
      'Cognitive Behavioral Therapy for substance use',
      'Relapse prevention training',
      'Psychoeducation about addiction and recovery',
      'Contingency management/reinforcement strategies',
      'Refer to and coordinate with 12-step or other support groups',
      'Family therapy to address enabling behaviors and improve support',
      'Coordinate with psychiatrist for medication-assisted treatment if indicated',
      'Process underlying trauma or mental health issues',
      'Develop healthy coping skills and lifestyle changes',
      'Crisis intervention and safety planning',
      'Case management for housing, employment, and other needs'
    ]
  },
  bipolar: {
    label: 'Bipolar Disorder',
    behavioralDefinitions: [
      'Episodes of elevated, expansive, or irritable mood',
      'Decreased need for sleep',
      'Increased talkativeness or pressured speech',
      'Racing thoughts or flight of ideas',
      'Increased goal-directed activity or psychomotor agitation',
      'Excessive involvement in risky activities',
      'Inflated self-esteem or grandiosity',
      'Distractibility',
      'Depressive episodes with low mood and energy',
      'Mood instability and rapid cycling',
      'Impaired judgment during mood episodes',
      'Difficulty maintaining relationships and employment'
    ],
    longTermGoals: [
      'Stabilize mood and reduce frequency/intensity of mood episodes',
      'Develop effective strategies for managing mood fluctuations',
      'Maintain medication compliance and psychiatric care',
      'Improve functioning in relationships, work, and daily life',
      'Recognize early warning signs of mood episodes'
    ],
    shortTermObjectives: [
      { objective: 'Maintain medication compliance', timeframe: 'Ongoing' },
      { objective: 'Identify personal early warning signs of mood episodes', timeframe: '3 weeks' },
      { objective: 'Establish regular sleep schedule', timeframe: '2 weeks' },
      { objective: 'Complete daily mood monitoring', timeframe: '1 week' },
      { objective: 'Develop action plan for emerging symptoms', timeframe: '4 weeks' },
      { objective: 'Reduce impulsive behaviors by 75%', timeframe: '8 weeks' },
      { objective: 'Identify and avoid triggers for mood episodes', timeframe: '4 weeks' },
      { objective: 'Build support network of at least 3 people', timeframe: '6 weeks' },
      { objective: 'Learn stress management techniques', timeframe: '4 weeks' }
    ],
    interventions: [
      'Psychoeducation about bipolar disorder and its management',
      'Cognitive Behavioral Therapy adapted for bipolar disorder',
      'Interpersonal and Social Rhythm Therapy (IPSRT)',
      'Family-focused therapy',
      'Coordinate closely with psychiatrist for medication management',
      'Develop mood monitoring system (chart, app)',
      'Create action plan for early intervention',
      'Teach sleep hygiene and circadian rhythm management',
      'Process grief related to diagnosis and its impact',
      'Develop relapse prevention plan',
      'Address substance use if present',
      'Crisis planning and safety planning'
    ]
  },
  relationship: {
    label: 'Relationship Issues',
    behavioralDefinitions: [
      'Frequent conflict with partner/family members',
      'Poor communication patterns',
      'Difficulty expressing needs and emotions',
      'Trust issues or betrayal trauma',
      'Codependency patterns',
      'Difficulty setting and maintaining boundaries',
      'Repeating unhealthy relationship patterns',
      'Attachment difficulties',
      'Isolation from social relationships',
      'Domestic conflict or abuse history',
      'Difficulty with intimacy',
      'Family of origin issues impacting current relationships'
    ],
    longTermGoals: [
      'Develop healthy communication skills',
      'Establish and maintain appropriate boundaries',
      'Build secure attachment patterns',
      'Resolve conflicts in a healthy manner',
      'Improve overall relationship satisfaction'
    ],
    shortTermObjectives: [
      { objective: 'Learn and practice active listening skills', timeframe: '2 weeks' },
      { objective: 'Identify personal boundaries and communicate them', timeframe: '3 weeks' },
      { objective: 'Use "I" statements during conflicts', timeframe: '2 weeks' },
      { objective: 'Identify attachment style and its impact', timeframe: '4 weeks' },
      { objective: 'Reduce frequency of arguments by 50%', timeframe: '6 weeks' },
      { objective: 'Increase positive interactions with partner/family', timeframe: '4 weeks' },
      { objective: 'Process past relationship wounds', timeframe: '8 weeks' },
      { objective: 'Develop conflict resolution strategies', timeframe: '4 weeks' },
      { objective: 'Identify and change codependent patterns', timeframe: '8 weeks' }
    ],
    interventions: [
      'Couples/family therapy if appropriate',
      'Communication skills training',
      'Attachment-focused interventions',
      'Emotionally Focused Therapy (EFT) techniques',
      'Explore family of origin patterns and their impact',
      'Teach boundary setting and assertiveness',
      'Process past relationship trauma',
      'Role-play healthy communication',
      'Gottman Method interventions',
      'Address domestic violence safety if applicable',
      'Build support network outside primary relationship',
      'Psychoeducation about healthy relationship patterns'
    ]
  }
};

const ProgressNotesList = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedNote, setSelectedNote] = useState<any>(null);
  const [locationName, setLocationName] = useState('');
  
  // Diagnosis & Treatment Plan state
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  
  // Treatment Plan Builder state
  const [selectedProblem, setSelectedProblem] = useState('');
  const [selectedBehaviors, setSelectedBehaviors] = useState<string[]>([]);
  const [selectedLongTermGoals, setSelectedLongTermGoals] = useState<string[]>([]);
  const [selectedObjectives, setSelectedObjectives] = useState<{objective: string, timeframe: string}[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [customObjective, setCustomObjective] = useState({ objective: '', timeframe: '4 weeks' });
  const [customIntervention, setCustomIntervention] = useState('');
  
  // Store the full treatment plan
  const [savedTreatmentPlan, setSavedTreatmentPlan] = useState<any>(null);

  // ============================================
  // CLAIMS STATE
  // ============================================
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [selectedNoteForClaim, setSelectedNoteForClaim] = useState<any>(null);
  const [practiceInfo, setPracticeInfo] = useState<any>(null);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [selectedPayer, setSelectedPayer] = useState<any>(null);
  const [payerSearch, setPayerSearch] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [feeSchedule, setFeeSchedule] = useState<{ [key: string]: number }>({});
  const [customPayers, setCustomPayers] = useState<any[]>([]);
  const [showAddPayerModal, setShowAddPayerModal] = useState(false);
  const [newPayerId, setNewPayerId] = useState('');
  const [newPayerName, setNewPayerName] = useState('');
  const [addingPayer, setAddingPayer] = useState(false);

  // Built-in payers with actual Stedi/EDI payer IDs
  const BUILT_IN_PAYERS = [
    // Oklahoma-specific payers
    { id: '840', name: 'Blue Cross Blue Shield of Oklahoma' },
    { id: '71064', name: 'HealthChoice Oklahoma' },
    { id: '75261', name: 'Healthcare Highways' },
    { id: 'OKMCD', name: 'Oklahoma Medicaid (SoonerCare)' },
    { id: '128OK', name: 'Aetna Better Health Oklahoma (Medicaid)' },
    { id: '68016', name: 'Oklahoma Complete Health (Centene)' },
    { id: '68023', name: 'Humana Healthy Horizons Oklahoma' },
    
    // Major national payers
    { id: '60054', name: 'Aetna' },
    { id: '87726', name: 'UnitedHealthcare' },
    { id: '62308', name: 'Cigna' },
    { id: '61101', name: 'Humana' },
    { id: '94265', name: 'Anthem Blue Cross Blue Shield' },
    { id: '39026', name: 'UMR (United Medical Resources)' },
    
    // Behavioral health / EAP
    { id: '01260', name: 'Magellan Healthcare' },
    { id: 'MHNET', name: 'MHNet Behavioral Health' },
    { id: 'OPTUM', name: 'Optum Behavioral Health' },
    { id: '77050', name: 'ComPsych' },
    { id: 'LYRA', name: 'Lyra Health' },
    { id: 'SPRING', name: 'Spring Health' },
    { id: '38217', name: 'Carelon Behavioral Health' },
    
    // Government
    { id: '99726', name: 'TRICARE West' },
    { id: '99727', name: 'TRICARE East' },
    { id: 'VAMC', name: 'Veterans Affairs' },
    { id: 'CMS', name: 'Medicare' },
    
    // Other major payers
    { id: '10093', name: 'Blue Shield of California' },
    { id: '84980', name: 'Blue Cross Blue Shield of Texas' },
    { id: 'SB700', name: 'Blue Cross Blue Shield of Massachusetts' },
    { id: 'G0062', name: 'Blue Cross Blue Shield of Illinois' },
    { id: '41112', name: 'Meritain Health' },
    { id: '35182', name: 'CoreSource' },
  ];

  useEffect(() => {
    if (id) {
      fetchPatientDetails();
      fetchProgressNotes();
      fetchLocationName();
    }
  }, [id]);

  const fetchLocationName = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/location/${LOCATION_ID}`);
      if (response.data.success && response.data.location?.name) {
        setLocationName(response.data.location.name);
      }
    } catch (error) {
      console.error('Error fetching location:', error);
      setLocationName('');
    }
  };

  const fetchPatientDetails = async () => {
    try {
      // Fetch patient basic info
      const response = await axios.get(`${API_URL}/api/patients/${id}`, {
        params: { locationId: LOCATION_ID }
      });
      if (response.data.success && response.data.patient) {
        setPatient(response.data.patient);
      }
      
      // Fetch diagnosis from our dedicated endpoint
      try {
        console.log('📋 Fetching diagnosis for patient:', id);
        const diagResponse = await axios.get(`${API_URL}/api/patients/${id}/diagnosis`, {
          params: { locationId: LOCATION_ID }
        });
        
        console.log('📋 Diagnosis response:', diagResponse.data);
        
        if (diagResponse.data.diagnosis) {
          const diagnoses = diagResponse.data.diagnosis.split('\n').filter((d: string) => d.trim());
          setSelectedDiagnoses(diagnoses);
          // Load diagnosis from localStorage
          const storedDiagnosis = localStorage.getItem(`diagnosis_${id}`);
          if (storedDiagnosis) {
            const diagnoses = storedDiagnosis.split('\n').filter((d: string) => d.trim());
            setSelectedDiagnoses(diagnoses);
          }
        }
        
        if (diagResponse.data.treatmentPlan) {
          const plan = diagResponse.data.treatmentPlan;
          setSavedTreatmentPlan(plan);
          setSelectedProblem(plan.problem || '');
          setSelectedBehaviors(plan.behaviors || []);
          setSelectedLongTermGoals(plan.longTermGoals || []);
          setSelectedObjectives(plan.objectives || []);
          setSelectedInterventions(plan.interventions || []);
        }
      } catch (diagError) {
        console.log('No diagnosis found or error:', diagError);
      }
    } catch (error) {
      console.error('Error fetching patient:', error);
    }
  };

  const fetchProgressNotes = async () => {
    try {
      const notesResponse = await axios.get(`${API_URL}/api/patients/${id}/notes`, {
        params: { locationId: LOCATION_ID }
      });
      const draftResponse = await axios.get(`${API_URL}/api/patients/${id}/draft`, {
        params: { locationId: LOCATION_ID }
      });

      const completedNotes = notesResponse.data.notes || [];
      const draft = draftResponse.data.draft;
      const allNotes = [...completedNotes];
      if (draft) allNotes.unshift(draft);
      setNotes(allNotes);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDiagnosis = async () => {
    setSavingDiagnosis(true);
    try {
      const treatmentPlanData = {
        problem: selectedProblem,
        behaviors: selectedBehaviors,
        longTermGoals: selectedLongTermGoals,
        objectives: selectedObjectives,
        interventions: selectedInterventions
      };

      console.log('💾 Saving diagnosis:', selectedDiagnoses.join('\n'));
      console.log('💾 Saving treatment plan:', treatmentPlanData);

      // Save to our diagnosis endpoint
      await axios.put(`${API_URL}/api/patients/${id}/diagnosis`, {
        diagnosis: selectedDiagnoses.join('\n'),
        treatmentPlan: treatmentPlanData
      }, {
        params: { locationId: LOCATION_ID }
      });
      // Save to localStorage for AddProgressNote to read
      localStorage.setItem(`diagnosis_${id}`, selectedDiagnoses.join('\n'));

      setSavedTreatmentPlan(treatmentPlanData);
      alert('Diagnosis and Treatment Plan saved successfully!');
      setShowDiagnosisModal(false);
    } catch (error: any) {
      console.error('Error saving:', error);
      alert(`Failed to save: ${error.response?.data?.error || error.message}`);
    } finally {
      setSavingDiagnosis(false);
    }
  };

  const addDiagnosis = (code: string, description: string) => {
    const diagnosisString = `${code} - ${description}`;
    if (!selectedDiagnoses.includes(diagnosisString)) {
      setSelectedDiagnoses([...selectedDiagnoses, diagnosisString]);
    }
    setDiagnosisSearch('');
  };

  const removeDiagnosis = (diagnosis: string) => {
    setSelectedDiagnoses(selectedDiagnoses.filter(d => d !== diagnosis));
  };

  const addObjective = (obj: {objective: string, timeframe: string}) => {
    if (!selectedObjectives.find(o => o.objective === obj.objective)) {
      setSelectedObjectives([...selectedObjectives, obj]);
    }
  };

  const removeObjective = (objective: string) => {
    setSelectedObjectives(selectedObjectives.filter(o => o.objective !== objective));
  };

  const addCustomObjective = () => {
    if (customObjective.objective.trim()) {
      setSelectedObjectives([...selectedObjectives, { ...customObjective }]);
      setCustomObjective({ objective: '', timeframe: '4 weeks' });
    }
  };

  const addIntervention = (intervention: string) => {
    if (!selectedInterventions.includes(intervention)) {
      setSelectedInterventions([...selectedInterventions, intervention]);
    }
  };

  const removeIntervention = (intervention: string) => {
    setSelectedInterventions(selectedInterventions.filter(i => i !== intervention));
  };

  const addCustomIntervention = () => {
    if (customIntervention.trim() && !selectedInterventions.includes(customIntervention)) {
      setSelectedInterventions([...selectedInterventions, customIntervention]);
      setCustomIntervention('');
    }
  };

  const filteredDiagnoses = ICD10_DIAGNOSES.filter(d => 
    d.code.toLowerCase().includes(diagnosisSearch.toLowerCase()) ||
    d.description.toLowerCase().includes(diagnosisSearch.toLowerCase())
  ).slice(0, 15);

  const currentProblemData = selectedProblem ? TREATMENT_PLAN_DATA[selectedProblem] : null;

  // Format treatment plan for display
  const formatTreatmentPlanDisplay = () => {
    if (!savedTreatmentPlan) return null;
    if (savedTreatmentPlan.legacyText) return savedTreatmentPlan.legacyText;
    
    const parts = [];
    if (savedTreatmentPlan.problem) {
      parts.push(`Problem: ${TREATMENT_PLAN_DATA[savedTreatmentPlan.problem]?.label || savedTreatmentPlan.problem}`);
    }
    if (savedTreatmentPlan.longTermGoals?.length) {
      parts.push(`Goals: ${savedTreatmentPlan.longTermGoals.length} long-term goal(s)`);
    }
    if (savedTreatmentPlan.objectives?.length) {
      parts.push(`${savedTreatmentPlan.objectives.length} objective(s)`);
    }
    if (savedTreatmentPlan.interventions?.length) {
      parts.push(`${savedTreatmentPlan.interventions.length} intervention(s)`);
    }
    return parts.join(' • ');
  };

  const handleEditDraft = (note: any) => {
    navigate(`/patients/${id}/add-progress-note`, { state: { draftData: note } });
  };

  const handleDeleteDraft = async (note: any) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) return;
    try {
      await axios.delete(`${API_URL}/api/patients/${id}/draft`, { params: { locationId: LOCATION_ID } });
      alert('Draft deleted successfully');
      fetchProgressNotes();
    } catch (error: any) {
      alert(`Failed to delete draft: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDownloadPDF = (note: any) => {
    const data = note.noteData || note;
    const status = getStatus(note);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to download the PDF');
      return;
    }

    const sessionDate = data.sessionDate 
      ? new Date(data.sessionDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'N/A';

    const signedDate = note.signedAt 
      ? new Date(note.signedAt).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
      : '';

    const formatArray = (arr: any) => {
      if (Array.isArray(arr) && arr.length > 0) return arr.join(', ');
      if (typeof arr === 'string' && arr) return arr;
      return 'N/A';
    };

    const practiceName = locationName || 'Practice Name';
    const createdDate = note.createdAt 
      ? new Date(note.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : 'N/A';

    const updatedDate = note.updatedAt 
      ? new Date(note.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      : 'N/A';
    const diagnosis = data.diagnosis || selectedDiagnoses.join(', ') || '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Progress Note - ${patient?.lastName || 'Patient'}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; line-height: 1.5; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e5e7eb; }
          .header h1 { font-size: 24px; color: #1f2937; margin-bottom: 5px; }
          .header .practice { text-align: right; color: #2563eb; font-weight: 600; font-size: 18px; }
          .header .practice small { display: block; color: #6b7280; font-weight: normal; font-size: 12px; }
          .status { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
          .status.signed { background: #d1fae5; color: #059669; }
          .status.draft { background: #fef3c7; color: #d97706; }
          .section { margin-bottom: 25px; }
          .section-title { font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb; }
          .section-title.risk { color: #dc2626; border-color: #fecaca; }
          .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
          .field { margin-bottom: 10px; }
          .field-label { font-size: 11px; color: #9ca3af; margin-bottom: 2px; }
          .field-value { font-size: 14px; color: #1f2937; }
          .field-value.highlight { color: #2563eb; font-weight: 600; }
          .text-block { margin-bottom: 15px; }
          .text-block label { font-size: 11px; color: #9ca3af; display: block; margin-bottom: 3px; }
          .text-block p { font-size: 14px; color: #1f2937; }
          .risk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }
          .risk-item label { font-size: 11px; color: #9ca3af; display: block; }
          .risk-item .value { font-weight: 600; }
          .risk-item .value.safe { color: #059669; }
          .risk-item .value.concern { color: #dc2626; }
          .diagnosis-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px 15px; margin-bottom: 20px; }
          .diagnosis-box label { font-size: 11px; color: #3b82f6; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 5px; }
          .diagnosis-box p { color: #1e40af; font-size: 14px; margin: 0; }
          .signature-box { margin-top: 30px; padding: 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; }
          .signature-box.draft { background: #fffbeb; border-color: #fde68a; }
          .signature-box h4 { color: #059669; margin-bottom: 10px; }
          .signature-box.draft h4 { color: #d97706; }
          .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; }
          @media print { body { padding: 20px; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="no-print" style="background: #2563eb; color: white; padding: 10px 20px; margin: -40px -40px 30px -40px; display: flex; justify-content: space-between; align-items: center;">
          <span>Progress Note Preview</span>
          <button onclick="window.print()" style="background: white; color: #2563eb; border: none; padding: 8px 20px; border-radius: 5px; cursor: pointer; font-weight: 600;">Download PDF / Print</button>
        </div>
       <div class="header">
  <div>
    <h1>Progress Note</h1>
    <span class="status ${status.status}">${status.label}</span>
  </div>
  <div class="practice">
    ${practiceName}
    <small>Electronic Medical Records</small>
  </div>
</div>

<div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding: 10px; background: #f9fafb; border-radius: 6px; font-size: 12px; color: #6b7280;">
  <div><strong>Created:</strong> ${createdDate}</div>
  <div><strong>Last Updated:</strong> ${updatedDate}</div>
</div>
        <div class="section">
          <div class="two-col">
            <div>
              <div class="section-title">Patient Information</div>
              <div class="field"><div class="field-value" style="font-size: 16px; font-weight: 600;">${patient?.firstName || ''} ${patient?.lastName || ''}</div></div>
              ${patient?.dateOfBirth ? `<div class="field"><div class="field-label">Date of Birth</div><div class="field-value">${new Date(patient.dateOfBirth).toLocaleDateString()}</div></div>` : ''}
            </div>
            <div>
              <div class="section-title">Provider</div>
              <div class="field"><div class="field-value" style="font-weight: 600;">${data.clinicianName || 'N/A'}</div></div>
              ${data.clinicianCredentials ? `<div class="field"><div class="field-value">${data.clinicianCredentials}</div></div>` : ''}
            </div>
          </div>
        </div>
        ${diagnosis ? `<div class="diagnosis-box"><label>Diagnosis</label><p>${diagnosis}</p></div>` : ''}
        <div class="section">
          <div class="section-title">Session Details</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
            <div class="field"><div class="field-label">Date of Service</div><div class="field-value">${sessionDate}</div></div>
            <div class="field"><div class="field-label">Time</div><div class="field-value">${data.sessionTime || 'N/A'}</div></div>
            <div class="field"><div class="field-label">Duration</div><div class="field-value">${data.duration || 'N/A'} min</div></div>
            <div class="field"><div class="field-label">CPT Code</div><div class="field-value highlight">${data.cptCode || 'N/A'}</div></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Presenting Problem</div>
          ${data.chiefComplaint ? `<div class="text-block"><label>Chief Complaint</label><p>${data.chiefComplaint}</p></div>` : ''}
          ${data.presentingProblem ? `<div class="text-block"><label>Description</label><p>${data.presentingProblem}</p></div>` : ''}
        </div>
        <div class="section">
          <div class="section-title">Mental Status Examination</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            <div class="field"><div class="field-label">Appearance</div><div class="field-value">${formatArray(data.appearance)}</div></div>
            <div class="field"><div class="field-label">Behavior</div><div class="field-value">${formatArray(data.behavior)}</div></div>
            <div class="field"><div class="field-label">Speech</div><div class="field-value">${formatArray(data.speech)}</div></div>
            <div class="field"><div class="field-label">Mood</div><div class="field-value">${data.mood || 'N/A'}</div></div>
            <div class="field"><div class="field-label">Affect</div><div class="field-value">${formatArray(data.affect)}</div></div>
            <div class="field"><div class="field-label">Thought Process</div><div class="field-value">${formatArray(data.thoughtProcess)}</div></div>
            <div class="field"><div class="field-label">Insight</div><div class="field-value">${data.insight || 'N/A'}</div></div>
            <div class="field"><div class="field-label">Judgment</div><div class="field-value">${data.judgment || 'N/A'}</div></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title risk">Risk Assessment</div>
          <div class="risk-grid">
            <div class="risk-item"><label>Suicidal Ideation</label><div class="value ${data.suicidalIdeation === 'Denied' ? 'safe' : 'concern'}">${data.suicidalIdeation || 'N/A'}</div></div>
            <div class="risk-item"><label>Homicidal Ideation</label><div class="value ${data.homicidalIdeation === 'Denied' ? 'safe' : 'concern'}">${data.homicidalIdeation || 'N/A'}</div></div>
            <div class="risk-item"><label>Self-Harm</label><div class="value ${data.selfHarmBehavior === 'Denied' ? 'safe' : 'concern'}">${data.selfHarmBehavior || 'N/A'}</div></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Clinical Information</div>
          ${data.interventions ? `<div class="text-block"><label>Interventions</label><p>${data.interventions}</p></div>` : ''}
          ${data.clinicalImpression ? `<div class="text-block"><label>Clinical Impression</label><p>${data.clinicalImpression}</p></div>` : ''}
          <div class="field"><div class="field-label">Prognosis</div><div class="field-value">${data.prognosis || 'Good'}</div></div>
        </div>
        <div class="signature-box ${status.status === 'draft' ? 'draft' : ''}">
          ${status.status === 'signed' ? `<h4>✓ Electronically Signed</h4><p><strong>${note.signedBy || data.clinicianName}</strong></p><p style="color: #6b7280; font-size: 13px;">Signed: ${signedDate}</p>` : `<h4>⚠ Draft - Not Signed</h4><p style="color: #6b7280;">This document has not been electronically signed.</p>`}
        </div>
        <div class="footer">
  <p>${practiceName} | Created: ${createdDate} | Updated: ${updatedDate}</p>
  <p>Generated on ${new Date().toLocaleString()} | CONFIDENTIAL - Protected Health Information</p>
</div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const getStatus = (note: any) => {
    if (note.status === 'draft' || (note.updatedAt && !note.signedAt && !note.createdAt)) {
      return { status: 'draft', label: 'Draft', class: 'bg-warning text-dark' };
    }
    if (note.signedAt || note.status === 'signed') {
      return { status: 'signed', label: 'Signed & Locked', class: 'bg-success text-white' };
    }
    return { status: 'draft', label: 'Draft', class: 'bg-warning text-dark' };
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatShortDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const filteredNotes = notes.filter(note => {
    if (filter === 'all') return true;
    return getStatus(note).status === filter;
  });

  // ============================================
  // CLAIMS FUNCTIONS
  // ============================================

  const fetchFeeSchedule = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/fee-schedule`, {
        params: { locationId: LOCATION_ID }
      });
      if (response.data.success) {
        setFeeSchedule(response.data.feeSchedule);
      }
    } catch (error) {
      console.error('Error fetching fee schedule:', error);
      setFeeSchedule({
        '90832': 95,
        '90834': 130,
        '90837': 175,
        '90847': 150,
        '90853': 50
      });
    }
  };

  const fetchCustomPayers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/custom-payers`, {
        params: { locationId: LOCATION_ID }
      });
      if (response.data.success) {
        setCustomPayers(response.data.payers || []);
      }
    } catch (error) {
      console.error('Error fetching custom payers:', error);
    }
  };

  const fetchPracticeInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/practice-info`, {
        params: { locationId: LOCATION_ID }
      });
      if (response.data.success) {
        setPracticeInfo(response.data.practiceInfo);
      }
    } catch (error) {
      console.error('Error fetching practice info:', error);
    }
  };

  const openClaimModal = async (note: any) => {
    setSelectedNoteForClaim(note);
    setSelectedPayer(null);
    setPayerSearch('');
    
    if (Object.keys(feeSchedule).length === 0) {
      await fetchFeeSchedule();
    }
    
    if (customPayers.length === 0) {
      await fetchCustomPayers();
    }
    
    const data = note.noteData || note;
    const defaultCharge = feeSchedule[data.cptCode] || 130;
    setChargeAmount(defaultCharge.toString());
    
    await fetchPracticeInfo();
    setShowClaimModal(true);
  };

  const handleSubmitClaim = async () => {
    if (!selectedPayer) {
      alert('Please select a payer');
      return;
    }
    
    if (!chargeAmount || parseFloat(chargeAmount) <= 0) {
      alert('Please enter a valid charge amount');
      return;
    }
    
    if (!practiceInfo?.npi) {
      alert('Practice NPI is required. Please update your location settings in GoHighLevel.');
      return;
    }
    
    setSubmittingClaim(true);
    
    try {
      const data = selectedNoteForClaim.noteData || selectedNoteForClaim;
      
      const diagnosisCodes = (data.diagnosis || selectedDiagnoses.join('\n') || '')
        .split('\n')
        .map((d: string) => d.split(' - ')[0].trim())
        .filter((d: string) => d && d.match(/^[A-Z]\d+/));
      
      const getCustomField = (key: string) => {
        const field = patient?.customFields?.find((f: any) => 
          f.key === key || f.fieldKey === key || f.key?.includes(key) || f.fieldKey?.includes(key)
        );
        return field?.value || '';
      };
      
      const claimData = {
        patientId: id,
        noteId: selectedNoteForClaim.id,
        payerId: selectedPayer.id,
        payerName: selectedPayer.name,
        practiceInfo: practiceInfo,
        patientInfo: {
          firstName: patient?.firstName || '',
          lastName: patient?.lastName || '',
          dateOfBirth: patient?.dateOfBirth || '',
          gender: patient?.gender || getCustomField('gender') || 'U',
          memberId: getCustomField('insurance_primary_member_id') || getCustomField('member_id'),
          groupNumber: getCustomField('insurance_primary_group_number') || getCustomField('group_number'),
          address: patient?.address1 || '',
          city: patient?.city || '',
          state: patient?.state || '',
          zip: patient?.postalCode || ''
        },
        serviceInfo: {
          sessionDate: data.sessionDate,
          cptCode: data.cptCode,
          diagnosisCodes: diagnosisCodes,
          clinicianName: data.clinicianName,
          placeOfService: data.sessionType === 'telehealth' ? '02' : '11'
        },
        chargeAmount: parseFloat(chargeAmount)
      };
      
      const response = await axios.post(
        `${API_URL}/api/claims/submit`,
        claimData,
        { params: { locationId: LOCATION_ID } }
      );
      
      if (response.data.success) {
        if (response.data.stediError) {
          alert(`Claim saved locally but Stedi returned an error:\n${JSON.stringify(response.data.stediError, null, 2)}\n\nThis may be because you're using test credentials.`);
        } else {
          alert('Claim submitted successfully!');
        }
        setShowClaimModal(false);
      } else {
        alert(`Failed to submit claim: ${response.data.error}`);
      }
    } catch (error: any) {
      console.error('Error submitting claim:', error);
      alert(`Failed to submit claim: ${error.response?.data?.error || error.message}`);
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleAddCustomPayer = async () => {
    if (!newPayerId.trim() || !newPayerName.trim()) {
      alert('Please enter both Payer ID and Payer Name');
      return;
    }
    
    setAddingPayer(true);
    
    try {
      const response = await axios.post(
        `${API_URL}/api/custom-payers`,
        { id: newPayerId.trim(), name: newPayerName.trim() },
        { params: { locationId: LOCATION_ID } }
      );
      
      if (response.data.success) {
        setCustomPayers([...customPayers, response.data.payer]);
        setShowAddPayerModal(false);
        setNewPayerId('');
        setNewPayerName('');
        setSelectedPayer(response.data.payer);
        alert('Payer added successfully!');
      } else {
        alert(`Failed to add payer: ${response.data.error}`);
      }
    } catch (error: any) {
      alert(`Error adding payer: ${error.response?.data?.error || error.message}`);
    } finally {
      setAddingPayer(false);
    }
  };

  const allPayers = [...BUILT_IN_PAYERS, ...customPayers];

  const filteredPayers = allPayers.filter(p => 
    p.name.toLowerCase().includes(payerSearch.toLowerCase()) ||
    p.id.toLowerCase().includes(payerSearch.toLowerCase())
  );

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <AutoBreadcrumb title="Progress Notes" />

          {patient && (
            <div className="card mb-3 bg-light">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h5 className="mb-1">{patient.firstName} {patient.lastName}</h5>
                    <p className="text-muted mb-0">Patient ID: {patient.id}</p>
                  </div>
                  <div className="d-flex gap-2">
                    <Link to={`/patients/${id}`} className="btn btn-outline-primary">
                      <i className="ti ti-arrow-left me-1" />Back to Patient
                    </Link>
                    <Link to={`/patients/${id}/billing`} className="btn btn-outline-success">
                      <i className="ti ti-receipt me-1" />Billing
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Diagnosis & Treatment Plan Card */}
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">
                <i className="ti ti-stethoscope me-2" />
                Diagnosis & Treatment Plan
              </h5>
              <button className="btn btn-sm btn-outline-primary" onClick={() => setShowDiagnosisModal(true)}>
                <i className="ti ti-edit me-1" />
                {selectedDiagnoses.length > 0 || savedTreatmentPlan ? 'Edit' : 'Add'}
              </button>
            </div>
            <div className="card-body">
              {selectedDiagnoses.length > 0 || savedTreatmentPlan ? (
                <div className="row">
                  <div className="col-md-6">
                    <h6 className="text-muted mb-2">Diagnosis</h6>
                    {selectedDiagnoses.length > 0 ? (
                      <ul className="list-unstyled mb-0">
                        {selectedDiagnoses.map((d, i) => (
                          <li key={i} className="mb-1">
                            <span className="badge bg-primary me-2">{d.split(' - ')[0]}</span>
                            {d.split(' - ').slice(1).join(' - ')}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted fst-italic">Not specified</span>
                    )}
                  </div>
                  <div className="col-md-6">
                    <h6 className="text-muted mb-2">Treatment Plan</h6>
                    {savedTreatmentPlan ? (
                      <p className="mb-0">{formatTreatmentPlanDisplay()}</p>
                    ) : (
                      <span className="text-muted fst-italic">Not specified</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted py-3">
                  <i className="ti ti-file-text fs-32 d-block mb-2" />
                  <p className="mb-0">No diagnosis or treatment plan recorded yet.</p>
                  <button className="btn btn-primary btn-sm mt-2" onClick={() => setShowDiagnosisModal(true)}>
                    <i className="ti ti-plus me-1" />Add Diagnosis & Treatment Plan
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Progress Notes Card */}
          <div className="card mb-3">
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  Progress Notes <span className="badge bg-primary ms-2">{filteredNotes.length}</span>
                </h5>
                <div className="d-flex gap-2">
                  <div className="btn-group" role="group">
                    <button type="button" className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFilter('all')}>All</button>
                    <button type="button" className={`btn btn-sm ${filter === 'draft' ? 'btn-warning text-dark' : 'btn-outline-warning'}`} onClick={() => setFilter('draft')}>Drafts</button>
                    <button type="button" className={`btn btn-sm ${filter === 'signed' ? 'btn-success' : 'btn-outline-success'}`} onClick={() => setFilter('signed')}>Signed</button>
                  </div>
                  <Link 
  to={`/patients/${id}/add-progress-note`} 
  state={{ newNote: true }}
  className="btn btn-sm btn-primary"
>
                    <i className="ti ti-plus me-1" />New Progress Note
                  </Link>
                </div>
              </div>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                  <p className="mt-2">Loading progress notes...</p>
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="text-center py-5">
                  <i className="ti ti-notes-off fs-48 text-muted mb-3 d-block" />
                  <h5>No Progress Notes Found</h5>
                  <p className="text-muted">{filter === 'all' ? 'Start by creating your first progress note' : `No ${filter} notes found`}</p>
                  <Link 
  to={`/patients/${id}/add-progress-note`}
  state={{ newNote: true }}
  className="btn btn-primary"
>
                    <i className="ti ti-plus me-1" />
                    New Progress Note
                  </Link>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Session Date</th>
                        <th>CPT Code</th>
                        <th>Clinician</th>
                        <th>Created/Modified</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNotes.map((note, index) => {
                        const noteStatus = getStatus(note);
                        const data = note.noteData || note;
                        return (
                          <tr key={note.id || `draft-${index}`}>
                            <td><strong>{formatShortDate(data.sessionDate || note.createdAt || note.updatedAt)}</strong></td>
                            <td><span className="badge bg-secondary">{data.cptCode || 'N/A'}</span></td>
                            <td>{data.clinicianName || 'N/A'}{data.clinicianCredentials && `, ${data.clinicianCredentials}`}</td>
                            <td>{formatDate(note.createdAt || note.updatedAt)}</td>
                            <td><span className={`badge ${noteStatus.class}`}>{noteStatus.label}</span></td>
                            <td className="text-end">
                              <button className="btn btn-sm btn-outline-primary me-1" data-bs-toggle="modal" data-bs-target="#viewNoteModal" onClick={() => setSelectedNote(note)} title="View Note"><i className="ti ti-eye" /></button>
                              <button className="btn btn-sm btn-outline-info me-1" onClick={() => handleDownloadPDF(note)} title="Download PDF"><i className="ti ti-download" /></button>
                              {noteStatus.status === 'signed' && (
                                <button className="btn btn-sm btn-outline-success me-1" onClick={() => openClaimModal(note)} title="Submit Claim">
                                  <i className="ti ti-receipt" />
                                </button>
                              )}
                              {noteStatus.status === 'draft' && (
                                <>
                                  <button className="btn btn-sm btn-outline-warning me-1" onClick={() => handleEditDraft(note)} title="Edit Draft"><i className="ti ti-edit" /></button>
                                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteDraft(note)} title="Delete Draft"><i className="ti ti-trash" /></button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        <CommonFooter />
      </div>

      {/* View Note Modal */}
      <div className="modal fade" id="viewNoteModal" tabIndex={-1}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title"><i className="ti ti-notes me-2" />Progress Note Details</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" />
            </div>
            <div className="modal-body">
              {selectedNote && (
                <div className="p-3">
                  <p><strong>Session Date:</strong> {formatShortDate((selectedNote.noteData || selectedNote).sessionDate)}</p>
                  <p><strong>Chief Complaint:</strong> {(selectedNote.noteData || selectedNote).chiefComplaint || 'N/A'}</p>
                  <p><strong>Presenting Problem:</strong> {(selectedNote.noteData || selectedNote).presentingProblem || 'N/A'}</p>
                  <p><strong>Interventions:</strong> {(selectedNote.noteData || selectedNote).interventions || 'N/A'}</p>
                  <p><strong>Clinical Impression:</strong> {(selectedNote.noteData || selectedNote).clinicalImpression || 'N/A'}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-info" onClick={() => selectedNote && handleDownloadPDF(selectedNote)}>
                <i className="ti ti-download me-1" />Download PDF
              </button>
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnosis & Treatment Plan Modal */}
      {showDiagnosisModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title"><i className="ti ti-stethoscope me-2" />Diagnosis & Treatment Plan Builder</h5>
                <button type="button" className="btn-close" onClick={() => setShowDiagnosisModal(false)} />
              </div>
              <div className="modal-body">
                {/* DIAGNOSIS SECTION */}
                <div className="mb-4">
                  <h6 className="fw-bold text-primary mb-3">
                    <i className="ti ti-list-check me-2" />
                    Diagnosis (ICD-10)
                  </h6>
                  
                  {/* Selected Diagnoses */}
                  {selectedDiagnoses.length > 0 && (
                    <div className="mb-3">
                      {selectedDiagnoses.map((diagnosis, index) => (
                        <div key={index} className="d-flex align-items-center justify-content-between bg-light p-2 rounded mb-2">
                          <div>
                            <span className="badge bg-primary me-2">{diagnosis.split(' - ')[0]}</span>
                            <span>{diagnosis.split(' - ').slice(1).join(' - ')}</span>
                          </div>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => removeDiagnosis(diagnosis)}>
                            <i className="ti ti-x" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Search Box */}
                  <div className="position-relative">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search ICD-10 codes (e.g., F32.1 or depression)..."
                      value={diagnosisSearch}
                      onChange={(e) => setDiagnosisSearch(e.target.value)}
                    />
                    {diagnosisSearch && (
                      <div className="position-absolute w-100 bg-white border rounded shadow-sm mt-1" style={{ zIndex: 1000, maxHeight: '300px', overflowY: 'auto' }}>
                        {filteredDiagnoses.length > 0 ? (
                          filteredDiagnoses.map((d, i) => (
                            <div
                              key={i}
                              className="p-2 cursor-pointer hover-bg-light border-bottom"
                              style={{ cursor: 'pointer' }}
                              onClick={() => addDiagnosis(d.code, d.description)}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8f9fa')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                            >
                              <span className="badge bg-secondary me-2">{d.code}</span>
                              <span>{d.description}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-3 text-muted text-center">No matching diagnoses found</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <hr />

                {/* TREATMENT PLAN SECTION */}
                <div>
                  <h6 className="fw-bold text-primary mb-3">
                    <i className="ti ti-clipboard-list me-2" />
                    Treatment Plan Builder
                  </h6>

                  {/* Problem Selection */}
                  <div className="mb-4">
                    <label className="form-label fw-bold">Problem Area</label>
                    <select
                      className="form-select"
                      value={selectedProblem}
                      onChange={(e) => {
                        setSelectedProblem(e.target.value);
                        setSelectedBehaviors([]);
                        setSelectedLongTermGoals([]);
                        setSelectedObjectives([]);
                        setSelectedInterventions([]);
                      }}
                    >
                      <option value="">Select a problem area...</option>
                      {Object.entries(TREATMENT_PLAN_DATA).map(([key, data]) => (
                        <option key={key} value={key}>{data.label}</option>
                      ))}
                    </select>
                  </div>

                  {currentProblemData && (
                    <>
                      {/* Behavioral Definitions */}
                      <div className="mb-4">
                        <label className="form-label fw-bold">Behavioral Definitions (Symptoms/Behaviors)</label>
                        <div className="row">
                          {currentProblemData.behavioralDefinitions.map((behavior: string, index: number) => (
                            <div key={index} className="col-md-6 mb-2">
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`behavior-${index}`}
                                  checked={selectedBehaviors.includes(behavior)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedBehaviors([...selectedBehaviors, behavior]);
                                    } else {
                                      setSelectedBehaviors(selectedBehaviors.filter(b => b !== behavior));
                                    }
                                  }}
                                />
                                <label className="form-check-label" htmlFor={`behavior-${index}`}>
                                  {behavior}
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Long-Term Goals */}
                      <div className="mb-4">
                        <label className="form-label fw-bold">Long-Term Goals</label>
                        <div className="row">
                          {currentProblemData.longTermGoals.map((goal: string, index: number) => (
                            <div key={index} className="col-12 mb-2">
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`goal-${index}`}
                                  checked={selectedLongTermGoals.includes(goal)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedLongTermGoals([...selectedLongTermGoals, goal]);
                                    } else {
                                      setSelectedLongTermGoals(selectedLongTermGoals.filter(g => g !== goal));
                                    }
                                  }}
                                />
                                <label className="form-check-label" htmlFor={`goal-${index}`}>
                                  {goal}
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Short-Term Objectives */}
                      <div className="mb-4">
                        <label className="form-label fw-bold">Short-Term Objectives</label>
                        
                        {/* Selected Objectives */}
                        {selectedObjectives.length > 0 && (
                          <div className="mb-3">
                            {selectedObjectives.map((obj, index) => (
                              <div key={index} className="d-flex align-items-center justify-content-between bg-success bg-opacity-10 p-2 rounded mb-2">
                                <div>
                                  <span>{obj.objective}</span>
                                  <span className="badge bg-info ms-2">{obj.timeframe}</span>
                                </div>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => removeObjective(obj.objective)}>
                                  <i className="ti ti-x" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Available Objectives */}
                        <div className="border rounded p-3 mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {currentProblemData.shortTermObjectives.map((obj: any, index: number) => (
                            <div
                              key={index}
                              className="d-flex align-items-center justify-content-between p-2 border-bottom"
                              style={{ cursor: 'pointer' }}
                              onClick={() => addObjective(obj)}
                            >
                              <span>{obj.objective}</span>
                              <span className="badge bg-secondary">{obj.timeframe}</span>
                            </div>
                          ))}
                        </div>

                        {/* Custom Objective */}
                        <div className="row g-2">
                          <div className="col-md-8">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Add custom objective..."
                              value={customObjective.objective}
                              onChange={(e) => setCustomObjective({ ...customObjective, objective: e.target.value })}
                            />
                          </div>
                          <div className="col-md-2">
                            <select
                              className="form-select form-select-sm"
                              value={customObjective.timeframe}
                              onChange={(e) => setCustomObjective({ ...customObjective, timeframe: e.target.value })}
                            >
                              <option value="1 week">1 week</option>
                              <option value="2 weeks">2 weeks</option>
                              <option value="3 weeks">3 weeks</option>
                              <option value="4 weeks">4 weeks</option>
                              <option value="6 weeks">6 weeks</option>
                              <option value="8 weeks">8 weeks</option>
                              <option value="10 weeks">10 weeks</option>
                              <option value="12 weeks">12 weeks</option>
                              <option value="Ongoing">Ongoing</option>
                            </select>
                          </div>
                          <div className="col-md-2">
                            <button className="btn btn-sm btn-outline-primary w-100" onClick={addCustomObjective}>
                              <i className="ti ti-plus" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Therapeutic Interventions */}
                      <div className="mb-4">
                        <label className="form-label fw-bold">Therapeutic Interventions</label>
                        
                        {/* Selected Interventions */}
                        {selectedInterventions.length > 0 && (
                          <div className="mb-3">
                            {selectedInterventions.map((intervention, index) => (
                              <div key={index} className="d-flex align-items-center justify-content-between bg-primary bg-opacity-10 p-2 rounded mb-2">
                                <span>{intervention}</span>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => removeIntervention(intervention)}>
                                  <i className="ti ti-x" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Available Interventions */}
                        <div className="row">
                          {currentProblemData.interventions.map((intervention: string, index: number) => (
                            <div key={index} className="col-md-6 mb-2">
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`intervention-${index}`}
                                  checked={selectedInterventions.includes(intervention)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      addIntervention(intervention);
                                    } else {
                                      removeIntervention(intervention);
                                    }
                                  }}
                                />
                                <label className="form-check-label" htmlFor={`intervention-${index}`}>
                                  {intervention}
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Custom Intervention */}
                        <div className="row g-2 mt-2">
                          <div className="col-md-10">
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder="Add custom intervention..."
                              value={customIntervention}
                              onChange={(e) => setCustomIntervention(e.target.value)}
                            />
                          </div>
                          <div className="col-md-2">
                            <button className="btn btn-sm btn-outline-primary w-100" onClick={addCustomIntervention}>
                              <i className="ti ti-plus" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDiagnosisModal(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleSaveDiagnosis} disabled={savingDiagnosis}>
                  {savingDiagnosis ? (
                    <><span className="spinner-border spinner-border-sm me-1" />Saving...</>
                  ) : (
                    <><i className="ti ti-check me-1" />Save</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Claim Modal */}
      {showClaimModal && selectedNoteForClaim && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title">
                  <i className="ti ti-receipt me-2" />
                  Submit Insurance Claim
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowClaimModal(false)} />
              </div>
              <div className="modal-body">
                
                {/* Billing Provider */}
                <div className="card mb-3 bg-light">
                  <div className="card-header py-2">
                    <h6 className="mb-0"><i className="ti ti-building me-2" />Billing Provider</h6>
                  </div>
                  <div className="card-body py-2">
                    {practiceInfo ? (
                      <div className="row">
                        <div className="col-md-6">
                          <small className="text-muted">Practice Name</small>
                          <p className="mb-1 fw-bold">{practiceInfo.name || <span className="text-danger">Not set</span>}</p>
                        </div>
                        <div className="col-md-3">
                          <small className="text-muted">NPI</small>
                          <p className="mb-1">{practiceInfo.npi || <span className="text-danger">Required</span>}</p>
                        </div>
                        <div className="col-md-3">
                          <small className="text-muted">Tax ID</small>
                          <p className="mb-1">{practiceInfo.taxId || <span className="text-warning">Not set</span>}</p>
                        </div>
                        <div className="col-12">
                          <small className="text-muted">Address</small>
                          <p className="mb-0">
                            {practiceInfo.address ? 
                              `${practiceInfo.address}, ${practiceInfo.city}, ${practiceInfo.state} ${practiceInfo.zip}` : 
                              <span className="text-warning">Not set</span>
                            }
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <div className="spinner-border spinner-border-sm" />
                        <span className="ms-2">Loading practice info...</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Patient Info */}
                <div className="card mb-3">
                  <div className="card-header py-2">
                    <h6 className="mb-0"><i className="ti ti-user me-2" />Patient Information</h6>
                  </div>
                  <div className="card-body py-2">
                    <div className="row">
                      <div className="col-md-4">
                        <small className="text-muted">Patient Name</small>
                        <p className="mb-1 fw-bold">{patient?.firstName} {patient?.lastName}</p>
                      </div>
                      <div className="col-md-2">
                        <small className="text-muted">DOB</small>
                        <p className="mb-1">
                          {patient?.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="col-md-3">
                        <small className="text-muted">Member ID</small>
                        <p className="mb-1">
                          {patient?.customFields?.find((f: any) => 
                            f.key?.includes('insurance_primary_member_id') || f.key?.includes('member_id')
                          )?.value || <span className="text-warning">Not set</span>}
                        </p>
                      </div>
                      <div className="col-md-3">
                        <small className="text-muted">Group #</small>
                        <p className="mb-1">
                          {patient?.customFields?.find((f: any) => 
                            f.key?.includes('insurance_primary_group_number') || f.key?.includes('group_number')
                          )?.value || <span className="text-muted">N/A</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Payer Selection */}
                <div className="card mb-3 border-primary">
                  <div className="card-header bg-primary text-white py-2 d-flex justify-content-between align-items-center">
                    <h6 className="mb-0"><i className="ti ti-building-bank me-2" />Select Insurance Payer</h6>
                    <button 
                      className="btn btn-sm btn-light" 
                      onClick={() => setShowAddPayerModal(true)}
                      title="Add payer not in list"
                    >
                      <i className="ti ti-plus me-1" />Add Payer
                    </button>
                  </div>
                  <div className="card-body">
                    {selectedPayer ? (
                      <div className="d-flex justify-content-between align-items-center bg-success bg-opacity-10 p-3 rounded border border-success">
                        <div>
                          <strong className="text-success">{selectedPayer.name}</strong>
                          {selectedPayer.custom && <span className="badge bg-info ms-2">Custom</span>}
                          <br />
                          <small className="text-muted">Payer ID: <code>{selectedPayer.id}</code></small>
                        </div>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedPayer(null)}>
                          <i className="ti ti-x me-1" />Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="input-group mb-2">
                          <span className="input-group-text"><i className="ti ti-search" /></span>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search by payer name or ID..."
                            value={payerSearch}
                            onChange={(e) => setPayerSearch(e.target.value)}
                          />
                          {payerSearch && (
                            <button className="btn btn-outline-secondary" onClick={() => setPayerSearch('')}>
                              <i className="ti ti-x" />
                            </button>
                          )}
                        </div>
                        <div style={{ maxHeight: '250px', overflowY: 'auto' }} className="border rounded">
                          {filteredPayers.length > 0 ? (
                            filteredPayers.map((payer) => (
                              <div
                                key={payer.id}
                                className="p-2 border-bottom d-flex justify-content-between align-items-center"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  setSelectedPayer(payer);
                                  setPayerSearch('');
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e8f5e9')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                              >
                                <div>
                                  <strong>{payer.name}</strong>
                                  {payer.custom && <span className="badge bg-info ms-2">Custom</span>}
                                  <br />
                                  <small className="text-muted">ID: <code>{payer.id}</code></small>
                                </div>
                                <i className="ti ti-chevron-right text-muted" />
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-4 text-muted">
                              <i className="ti ti-search-off fs-24 d-block mb-2" />
                              <p className="mb-2">No payers found</p>
                              <button 
                                className="btn btn-sm btn-primary"
                                onClick={() => setShowAddPayerModal(true)}
                              >
                                <i className="ti ti-plus me-1" />Add Custom Payer
                              </button>
                            </div>
                          )}
                        </div>
                        <small className="text-muted mt-2 d-block">
                          <i className="ti ti-info-circle me-1" />
                          {allPayers.length} payers available ({customPayers.length} custom)
                        </small>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Service Details */}
                <div className="card mb-3">
                  <div className="card-header py-2">
                    <h6 className="mb-0"><i className="ti ti-file-invoice me-2" />Service Details</h6>
                  </div>
                  <div className="card-body py-2">
                    {(() => {
                      const data = selectedNoteForClaim.noteData || selectedNoteForClaim;
                      const diagCodes = (data.diagnosis || selectedDiagnoses.join('\n') || '').split('\n').filter((d: string) => d.trim());
                      return (
                        <div className="row">
                          <div className="col-md-3">
                            <small className="text-muted">Date of Service</small>
                            <p className="mb-1 fw-bold">
                              {data.sessionDate ? new Date(data.sessionDate).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                          <div className="col-md-2">
                            <small className="text-muted">CPT Code</small>
                            <p className="mb-1">
                              <span className="badge bg-primary fs-14">{data.cptCode}</span>
                            </p>
                          </div>
                          <div className="col-md-3">
                            <small className="text-muted">Place of Service</small>
                            <p className="mb-1">
                              {data.sessionType === 'telehealth' ? (
                                <><i className="ti ti-device-laptop me-1" />02 - Telehealth</>
                              ) : (
                                <><i className="ti ti-building me-1" />11 - Office</>
                              )}
                            </p>
                          </div>
                          <div className="col-md-4">
                            <small className="text-muted">Charge Amount *</small>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text">$</span>
                              <input
                                type="number"
                                className="form-control fw-bold"
                                value={chargeAmount}
                                onChange={(e) => setChargeAmount(e.target.value)}
                                step="0.01"
                                min="0"
                              />
                            </div>
                            {feeSchedule[data.cptCode] && (
                              <small className="text-muted">
                                Fee schedule: ${feeSchedule[data.cptCode]}
                              </small>
                            )}
                          </div>
                          <div className="col-12 mt-2">
                            <small className="text-muted">Diagnosis Codes</small>
                            <div>
                              {diagCodes.length > 0 ? (
                                diagCodes.map((d: string, i: number) => {
                                  const code = d.split(' - ')[0].trim();
                                  const desc = d.split(' - ').slice(1).join(' - ').trim();
                                  return (
                                    <span key={i} className="badge bg-info me-1 mb-1" title={desc}>
                                      {code}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-danger">No diagnosis codes - required for claims</span>
                              )}
                            </div>
                          </div>
                          <div className="col-12 mt-2">
                            <small className="text-muted">Rendering Provider</small>
                            <p className="mb-0">{data.clinicianName || 'Not specified'}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
              </div>
              <div className="modal-footer">
                <Link to={`/patients/${id}/billing`} className="btn btn-outline-info me-auto">
                  <i className="ti ti-receipt me-1" />View Billing History
                </Link>
                <button type="button" className="btn btn-secondary" onClick={() => setShowClaimModal(false)}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-success" 
                  onClick={handleSubmitClaim}
                  disabled={submittingClaim || !selectedPayer || !practiceInfo?.npi}
                >
                  {submittingClaim ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <i className="ti ti-send me-1" />
                      Submit Claim
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Payer Modal */}
      {showAddPayerModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header bg-info text-white">
                <h5 className="modal-title">
                  <i className="ti ti-plus me-2" />
                  Add Custom Payer
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddPayerModal(false)} />
              </div>
              <div className="modal-body">
                <p className="text-muted mb-3">
                  Add a payer that's not in the built-in list. You'll need the payer's EDI Payer ID.
                </p>
                <div className="mb-3">
                  <label className="form-label">Payer ID (EDI) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., 12345 or PAYERID"
                    value={newPayerId}
                    onChange={(e) => setNewPayerId(e.target.value.toUpperCase())}
                    maxLength={20}
                  />
                  <small className="text-muted">
                    The EDI payer ID is usually 5 digits or alphanumeric. Contact the payer or your clearinghouse if unsure.
                  </small>
                </div>
                <div className="mb-3">
                  <label className="form-label">Payer Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., ABC Insurance Company"
                    value={newPayerName}
                    onChange={(e) => setNewPayerName(e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPayerModal(false)}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-info" 
                  onClick={handleAddCustomPayer}
                  disabled={addingPayer || !newPayerId.trim() || !newPayerName.trim()}
                >
                  {addingPayer ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <i className="ti ti-check me-1" />
                      Add Payer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProgressNotesList;