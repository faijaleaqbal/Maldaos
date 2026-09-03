'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CampusLocation, Issue, IssueCategory, IssuePriority, User } from '@/types';
import { MOCK_BUILDINGS } from '@/services/mockData';
import { AIService } from '@/services/ai.service';
import { useIssues } from '@/context/IssuesContext';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImageUploader } from './ImageUploader';
import { LocationPicker } from './LocationPicker';
import { AIAnalysisPanel } from '@/components/ai/AIAnalysisPanel';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import {
  FileText,
  Camera,
  MapPin,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  ShieldAlert,
  Clock,
  QrCode,
  ExternalLink,
} from 'lucide-react';

const CATEGORY_OPTIONS: { label: string; value: IssueCategory }[] = [
  { label: 'Electrical & Power Supply', value: 'ELECTRICAL' },
  { label: 'Plumbing & Water Supply', value: 'PLUMBING' },
  { label: 'IT, Wi-Fi & Network Systems', value: 'IT_NETWORK' },
  { label: 'Classroom & Furniture (Desks, Projector, Board)', value: 'FACILITY_CLASSROOM' },
  { label: 'Laboratory Equipment & Scientific Apparatus', value: 'LAB_EQUIPMENT' },
  { label: 'Sanitation, Washroom & Waste Management', value: 'SANITATION' },
  { label: 'Campus Safety & Physical Security', value: 'SAFETY_SECURITY' },
  { label: 'Hostel Infrastructure', value: 'HOSTEL' },
  { label: 'Other Facility Concern', value: 'OTHER' },
];

export const ReportWorkflow: React.FC = () => {
  const router = useRouter();
  const { createIssue, issues } = useIssues();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdIssue, setCreatedIssue] = useState<Issue | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<IssueCategory>('FACILITY_CLASSROOM');
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM');
  const [description, setDescription] = useState('');
  const [isSafetyHazard, setIsSafetyHazard] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [location, setLocation] = useState<CampusLocation>({
    building: MOCK_BUILDINGS[0].name,
    buildingCode: MOCK_BUILDINGS[0].code,
    floor: '1st Floor',
    roomOrLandmark: '',
    coordinates: { lat: MOCK_BUILDINGS[0].lat, lng: MOCK_BUILDINGS[0].lng },
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep = (currentStep: number): boolean => {
    const errs: Record<string, string> = {};

    if (currentStep === 1) {
      if (!title.trim() || title.trim().length < 6) {
        errs.title = 'Please provide a descriptive title (at least 6 characters).';
      }
      if (!description.trim() || description.trim().length < 15) {
        errs.description = 'Please describe the problem in detail (minimum 15 characters).';
      }
    }

    if (currentStep === 3) {
      if (!location.roomOrLandmark.trim()) {
        errs.location = 'Please specify the room number, lab, or specific landmark.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => (prev < 4 ? ((prev + 1) as any) : prev));
    }
  };

  const handleBack = () => {
    setStep((prev) => (prev > 1 ? ((prev - 1) as any) : prev));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Perform AI Analysis Triage
      let analysis;
      try {
        analysis = await AIService.analyzeIssue(title, description, location.building, issues);
      } catch (e) {
        analysis = AIService.getFallbackAnalysis();
      }

      // Department routing mapping
      let department = 'Campus Infrastructure Helpdesk';
      if (category === 'ELECTRICAL') department = 'Electrical & Facility Operations';
      else if (category === 'PLUMBING') department = 'Civil Works & Plumbing';
      else if (category === 'IT_NETWORK') department = 'IT & Network Cell';
      else if (category === 'FACILITY_CLASSROOM') department = 'Academic Infrastructure & IQAC';
      else if (category === 'LAB_EQUIPMENT') department = 'IT & Network Cell';
      else if (category === 'SANITATION') department = 'Civil Works & Sanitation';
      else if (category === 'SAFETY_SECURITY') department = 'Campus Security & Estate Office';
      else if (category === 'HOSTEL') department = 'Hostel Superintendent Office';

      const finalPriority: IssuePriority = isSafetyHazard
        ? 'CRITICAL'
        : analysis.suggestedPriority || priority;

      const created = await createIssue({
        title,
        description,
        category,
        priority: finalPriority,
        status: 'AI_ANALYZED',
        location,
        reporter: {
          id: user.id,
          name: user.name,
          role: user.role,
          studentId: user.studentId,
          department: user.department,
        },
        department,
        images,
        aiAnalysis: analysis,
      });

      setCreatedIssue(created);
      setStep(5);
    } catch (err: any) {
      setErrors({ submit: err.message || 'Failed to submit issue report.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabels = [
    { num: 1, label: 'Description', icon: FileText },
    { num: 2, label: 'Evidence', icon: Camera },
    { num: 3, label: 'Location', icon: MapPin },
    { num: 4, label: 'Review', icon: CheckCircle },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Workflow Stepper Header (Only shown during steps 1-4) */}
      {step < 5 && (
        <div className="bg-white rounded-lg border border-warm-300 p-4 shadow-subtle">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-warm-200 -z-0" />
            <div
              className="absolute top-4 left-4 h-0.5 bg-maroon-700 -z-0 transition-all duration-300"
              style={{ width: `${((step - 1) / (stepLabels.length - 1)) * 100}%` }}
            />

            {stepLabels.map((s) => {
              const isDone = step > s.num;
              const isCurrent = step === s.num;
              const Icon = s.icon;

              return (
                <div key={s.num} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-semibold transition-colors ${
                      isDone
                        ? 'bg-maroon-700 border-maroon-700 text-white'
                        : isCurrent
                        ? 'bg-white border-maroon-700 text-maroon-700 ring-4 ring-maroon-100'
                        : 'bg-warm-100 border-warm-300 text-ink-muted'
                    }`}
                  >
                    {isDone ? <CheckCircle className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span
                    className={`text-[11px] font-medium mt-1.5 ${
                      isCurrent ? 'text-maroon-800 font-semibold' : 'text-ink-muted'
                    }`}
                  >
                    Step {s.num}: {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 1: Description */}
      {step === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-warm-300 p-5 sm:p-6 shadow-card space-y-5"
        >
          <div className="border-b border-warm-200 pb-3">
            <h3 className="font-serif font-semibold text-lg text-ink">Step 1: Describe Campus Issue</h3>
            <p className="text-xs sm:text-sm text-ink-muted">
              Provide clear details so the appropriate Malda College maintenance cell can take action.
            </p>
          </div>

          <Input
            label="Issue Title / Subject *"
            placeholder="e.g. Projector lamp flickering in Room 204, Water cooler leak outside Optics Lab..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
          />

          <Select
            label="Infrastructure Category *"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(e) => setCategory(e.target.value as IssueCategory)}
          />

          <Textarea
            label="Detailed Description *"
            rows={4}
            placeholder="Describe what happened, when you noticed it, and how it impacts classes or student safety..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={errors.description}
            helperText="Include relevant details like equipment brand, floor water spread, or strange sounds/odors."
          />

          {/* Safety Hazard Toggle */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 flex items-start gap-3">
            <input
              type="checkbox"
              id="safety-toggle"
              checked={isSafetyHazard}
              onChange={(e) => setIsSafetyHazard(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-amber-300 text-maroon-700 focus:ring-maroon-700 cursor-pointer"
            />
            <label htmlFor="safety-toggle" className="text-xs text-ink cursor-pointer">
              <span className="font-semibold text-amber-900 block flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                This is an immediate safety or electrical hazard
              </span>
              Check this if there is exposed live wiring, sparking, flooding near electrical outlets, or structural danger. This triggers immediate priority escalation.
            </label>
          </div>

          <div className="flex justify-end pt-3 border-t border-warm-200">
            <Button onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Proceed to Photo Evidence
            </Button>
          </div>
        </motion.div>
      )}

      {/* STEP 2: Photo / Evidence */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-warm-300 p-5 sm:p-6 shadow-card space-y-5"
        >
          <div className="border-b border-warm-200 pb-3">
            <h3 className="font-serif font-semibold text-lg text-ink">Step 2: Upload Photo / Evidence</h3>
            <p className="text-xs sm:text-sm text-ink-muted">
              Photographic evidence speeds up maintenance response times by over 60%.
            </p>
          </div>

          <ImageUploader images={images} onChange={setImages} />

          <div className="flex items-center justify-between pt-3 border-t border-warm-200">
            <Button variant="secondary" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
            <Button onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Proceed to Campus Location
            </Button>
          </div>
        </motion.div>
      )}

      {/* STEP 3: Campus Location */}
      {step === 3 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-warm-300 p-5 sm:p-6 shadow-card space-y-5"
        >
          <div className="border-b border-warm-200 pb-3">
            <h3 className="font-serif font-semibold text-lg text-ink">Step 3: Select Campus Location</h3>
            <p className="text-xs sm:text-sm text-ink-muted">
              Pinpoint the building, floor, and exact room on the Malda College campus map.
            </p>
          </div>

          <LocationPicker location={location} onChange={setLocation} />
          {errors.location && <p className="text-xs text-rose-600 font-medium">{errors.location}</p>}

          <div className="flex items-center justify-between pt-3 border-t border-warm-200">
            <Button variant="secondary" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
            <Button onClick={handleNext} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Review Report
            </Button>
          </div>
        </motion.div>
      )}

      {/* STEP 4: Review Report */}
      {step === 4 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg border border-warm-300 p-5 sm:p-6 shadow-card space-y-5"
        >
          <div className="border-b border-warm-200 pb-3">
            <h3 className="font-serif font-semibold text-lg text-ink">Step 4: Review Your Report</h3>
            <p className="text-xs sm:text-sm text-ink-muted">
              Verify all details before dispatching to the Malda College operations desk.
            </p>
          </div>

          {/* Structured Review Card */}
          <div className="rounded-lg border border-warm-300 bg-warm-100/70 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warm-200 pb-3">
              <div>
                <span className="text-[11px] text-ink-muted uppercase font-medium block">Category</span>
                <span className="font-medium text-ink text-sm">{category.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-[11px] text-ink-muted uppercase font-medium block">Priority Status</span>
                <PriorityBadge priority={isSafetyHazard ? 'CRITICAL' : priority} />
              </div>
            </div>

            <div>
              <span className="text-[11px] text-ink-muted uppercase font-medium block">Title</span>
              <h4 className="font-serif font-semibold text-base text-ink">{title}</h4>
            </div>

            <div>
              <span className="text-[11px] text-ink-muted uppercase font-medium block">Description</span>
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed whitespace-pre-wrap">{description}</p>
            </div>

            <div>
              <span className="text-[11px] text-ink-muted uppercase font-medium block">Location</span>
              <p className="text-xs sm:text-sm text-ink font-medium">
                {location.building} • {location.floor} • {location.roomOrLandmark}
              </p>
            </div>

            {images.length > 0 && (
              <div>
                <span className="text-[11px] text-ink-muted uppercase font-medium block mb-2">
                  Evidence Photos ({images.length})
                </span>
                <div className="flex gap-2 overflow-x-auto py-1">
                  {images.map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={i}
                      src={img}
                      alt="Thumbnail"
                      className="w-16 h-16 object-cover rounded border border-warm-300"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-warm-200 text-xs text-ink-muted flex items-center gap-2">
              <span>Reported by: <strong>{user.name}</strong> ({user.role})</span>
              {user.studentId && <span>• ID: {user.studentId}</span>}
            </div>
          </div>

          {/* Submission Notice */}
          <div className="rounded-md border border-ai-border bg-ai-surface p-3 text-xs text-ai-text flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-ai-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold block">What happens when you click Submit?</span>
              <p className="text-ink-muted leading-relaxed">
                CampusPulse automated triage parses your incident description, analyzes similarities against known campus faults, tags appropriate maintenance cells, and alerts duty officers.
              </p>
            </div>
          </div>

          {errors.submit && <p className="text-xs text-rose-600 font-medium">{errors.submit}</p>}

          <div className="flex items-center justify-between pt-3 border-t border-warm-200">
            <Button variant="secondary" onClick={handleBack} leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Location
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              rightIcon={<CheckCircle className="w-4 h-4" />}
            >
              Submit Ticket to Operations Desk
            </Button>
          </div>
        </motion.div>
      )}

      {/* STEP 5: Submission Confirmation Receipt */}
      {step === 5 && createdIssue && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-lg border border-warm-300 p-6 sm:p-8 shadow-card space-y-6"
        >
          {/* Header Receipt Badge */}
          <div className="text-center space-y-2 pb-6 border-b border-warm-200">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-8 h-8" />
            </div>
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-800">
              Malda College Operations Registry
            </span>
            <h2 className="font-serif font-bold text-2xl sm:text-3xl text-ink">
              Ticket Successfully Registered
            </h2>
            <div className="inline-block bg-warm-100 border border-warm-300 rounded-md px-4 py-1.5 font-mono text-base font-bold text-maroon-900 mt-2">
              Ticket ID: {createdIssue.ticketNumber}
            </div>
          </div>

          {/* Submission Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="p-3 bg-warm-50 rounded border border-warm-200 space-y-1">
              <span className="text-ink-muted text-xs uppercase font-medium">Current Status</span>
              <div>
                <IssueStatusBadge status={createdIssue.status} size="md" />
              </div>
            </div>

            <div className="p-3 bg-warm-50 rounded border border-warm-200 space-y-1">
              <span className="text-ink-muted text-xs uppercase font-medium">Assigned Priority</span>
              <div>
                <PriorityBadge priority={createdIssue.priority} size="md" />
              </div>
            </div>

            <div className="p-3 bg-warm-50 rounded border border-warm-200 space-y-1">
              <span className="text-ink-muted text-xs uppercase font-medium">Assigned Department</span>
              <div className="font-semibold text-ink">{createdIssue.department}</div>
            </div>

            <div className="p-3 bg-warm-50 rounded border border-warm-200 space-y-1">
              <span className="text-ink-muted text-xs uppercase font-medium">Location</span>
              <div className="font-semibold text-ink truncate">
                {createdIssue.location.building.split('(')[0]} ({createdIssue.location.roomOrLandmark})
              </div>
            </div>

            <div className="p-3 bg-warm-50 rounded border border-warm-200 space-y-1 sm:col-span-2">
              <span className="text-ink-muted text-xs uppercase font-medium">Submitted Time</span>
              <div className="font-mono text-ink">
                {new Date(createdIssue.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'medium',
                })}
              </div>
            </div>
          </div>

          {/* AI Analysis Panel right on confirmation */}
          {createdIssue.aiAnalysis && (
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">
                Automated Incident Triage Report
              </h4>
              <AIAnalysisPanel analysis={createdIssue.aiAnalysis} />
            </div>
          )}

          {/* What Happens Next Section */}
          <div className="rounded-lg border border-warm-200 bg-warm-50 p-4 space-y-2">
            <h5 className="font-serif font-semibold text-sm text-ink flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-maroon-700" />
              What Happens Next?
            </h5>
            <ol className="list-decimal list-inside text-xs text-ink-muted space-y-1 leading-relaxed">
              <li>Duty officer reviews AI category and priority suggestions.</li>
              <li>A technician from {createdIssue.department} will be assigned within the active shift.</li>
              <li>You will receive real-time notifications on your student dashboard as progress is made.</li>
            </ol>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-warm-200">
            <Button
              variant="outline"
              onClick={() => {
                setTitle('');
                setDescription('');
                setImages([]);
                setStep(1);
                setCreatedIssue(null);
              }}
            >
              Report Another Issue
            </Button>

            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button variant="secondary">Go to Dashboard</Button>
              </Link>
              <Link href={`/issues/${createdIssue.id}`}>
                <Button variant="primary" rightIcon={<ExternalLink className="w-4 h-4" />}>
                  Track Live Ticket
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
