import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/feedback/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

interface CaseTemplateDialogProps {
  asin: string;
  reviewId: string;
  review?: {
    title?: string;
    content?: string;
  };
  violation: {
    type: string;
    category: string;
    details: string;
  };
}

export function CaseTemplateDialog({ asin, reviewId, review, violation }: CaseTemplateDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const { toast } = useToast();

  // Get first 2-3 sentences of the details
  const getBriefDetails = (details: string) => {
    if (!details) return '';
    const sentences = details.split(/[.!?]+\s+/).filter(s => s.trim());
    return sentences.slice(0, 2).join('. ') + '.';
  };

  const template = `Dear Amazon Seller Support,

I am writing regarding a review on ASIN ${asin} (https://www.amazon.com/dp/${asin}) that requires evaluation for removal based on Amazon's Content Guidelines.

Review link: https://www.amazon.com/gp/customer-reviews/${reviewId}

Review Content:
${review?.title ? `Title: "${review.title}"` : ''}
${review?.content ? `Content: "${review.content}"` : ''}

This review has been flagged for the following violation:

Type: ${violation.type}
Category: ${violation.category}

Details: ${getBriefDetails(violation.details)}

Based on Amazon's Community Guidelines, this type of content is not appropriate for customer reviews. Please evaluate this review for removal based on the documented violation.

Thank you for your attention to this matter.

Best regards,
[Your name]`;

  const handleCopy = async () => {
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(template);
      toast({
        title: 'Template Copied',
        description: 'The case template has been copied to your clipboard.',
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy template to clipboard',
        variant: 'destructive',
      });
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          size="sm"
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
        >
          Case Template
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Case Template</DialogTitle>
          <DialogDescription>
            Use this template to report the review violation to Amazon Seller Support
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={template}
            readOnly
            className="min-h-[400px] font-mono text-sm"
          />
          <div className="flex justify-end">
            <Button 
              onClick={handleCopy} 
              disabled={isCopying}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isCopying ? (
                <LoadingSpinner className="mr-2" size="sm" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Copy Template
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}