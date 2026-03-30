import { ChevronRightIcon, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DistillationJob } from '@/types/distillationTypes';
import { TEACHER_MODELS, STUDENT_MODELS } from '@/types/distillationTypes';
import { ItemRow } from '@/components/shared/ItemRow';
import { JobMetrics } from './JobMetrics';
import { Button } from '@/components/ui/button';
import { STATUS_CONFIG } from '../constants';
import { formatRelativeTime } from '../utils';

interface JobCardProps {
  job: DistillationJob;
  onClick: () => void;
  onDelete?: (jobId: string) => void;
}

export function JobCard({ job, onClick, onDelete }: JobCardProps) {
  const canDelete = !['pending', 'running'].includes(job.status);
  const statusConfig = STATUS_CONFIG[job.status];
  const teacherName =
    TEACHER_MODELS.find((m) => m.id === job.config.teacher_model)?.name || job.config.teacher_model;
  const studentName =
    STUDENT_MODELS.find((m) => m.id === job.config.student_model)?.name || job.config.student_model;

  const descriptionParts = [
    <span key="models">
      {teacherName} &rarr; {studentName}
    </span>,
    <span key="time" className="tabular-nums">
      {formatRelativeTime(job.created_at)}
    </span>,
  ];

  return (
    <ItemRow
      name={job.name}
      badge={<Badge variant={statusConfig.badgeVariant}>{statusConfig.label}</Badge>}
      descriptionParts={descriptionParts}
      onClick={onClick}
      size="default"
      extraContent={
        <JobMetrics
          status={job.status}
          progress={job.progress.overall_progress}
          cost={job.cost_accrued}
        />
      }
      actions={
        <>
          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(job.id);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronRightIcon className="size-4" />
          </Button>
        </>
      }
    />
  );
}
