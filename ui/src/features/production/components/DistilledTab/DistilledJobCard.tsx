import { Eye, Loader2, Rocket } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
  CardAction,
} from '@/components/ui/card';
import { InfoRow } from '../ModelsTab/DeploymentCard/InfoRow';
import type { DistillationJob } from '@/types/distillationTypes';
import { STUDENT_MODELS, TEACHER_MODELS, QUANTIZATION_OPTIONS } from '@/types/distillationTypes';

type Props = {
  job: DistillationJob;
  isDeploying: boolean;
  onDeploy: (jobId: string) => void;
  onViewResults: (jobId: string) => void;
};

export function DistilledJobCard({ job, isDeploying, onDeploy, onViewResults }: Props) {
  const studentName =
    STUDENT_MODELS.find((m) => m.id === job.config.student_model)?.name ??
    job.config.student_model ??
    '\u2014';

  const teacherName =
    TEACHER_MODELS.find((m) => m.id === job.config.teacher_model)?.name ??
    job.config.teacher_model ??
    '\u2014';

  const qualityScore =
    job.results?.quality_score != null
      ? `${(job.results.quality_score * 100).toFixed(0)}%`
      : '\u2014';

  const quantization =
    QUANTIZATION_OPTIONS.find((q) => q.id === job.config.quantization)?.name ??
    job.config.quantization ??
    '\u2014';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{job.name}</CardTitle>
        <CardDescription>
          Completed{' '}
          {job.completed_at
            ? new Date(job.completed_at).toLocaleDateString()
            : new Date(job.created_at).toLocaleDateString()}
        </CardDescription>
        <CardAction>
          <Badge variant="secondary">Completed</Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-2">
        <InfoRow label="Student Model" value={studentName} />
        <InfoRow label="Teacher Model" value={teacherName} />
        <InfoRow label="Quality Score" value={qualityScore} />
        <InfoRow label="Quantization" value={quantization} />
      </CardContent>

      <CardFooter className="gap-2">
        <Button variant="outline" className="flex-1" onClick={() => onViewResults(job.id)}>
          <Eye className="w-4 h-4" />
          View Results
        </Button>
        <Button className="flex-1" onClick={() => onDeploy(job.id)} disabled={isDeploying}>
          {isDeploying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Rocket className="w-4 h-4" />
          )}
          Deploy
        </Button>
      </CardFooter>
    </Card>
  );
}
