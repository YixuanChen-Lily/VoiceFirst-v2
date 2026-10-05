import React from 'react';
import { Card, CardContent } from '../ui/card';
import { SectionHeader } from './SectionHeader';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { FileText } from 'lucide-react';
import { useProposal } from '../../context/ProposalContext';

export function CoverPageSection() {
  const { data, updateField } = useProposal();

  return (
    <Card className="border-2 border-emerald-200 shadow-lg">
      <CardContent className="p-8">
        <SectionHeader
          number={1}
          title="Cover Page"
          icon={FileText}
          description="Basic information about your grant proposal"
        />

        <div className="space-y-6">
          <div>
            <Label htmlFor="project-title">Project Title *</Label>
            <Input
              id="project-title"
              placeholder="Enter your project title"
              className="mt-2"
              value={data.projectTitle}
              onChange={(e) => updateField('projectTitle', e.target.value)}
            />
            <p className="text-xs text-stone-500 mt-2 italic">
              Example: Establishing a Community-Owned Crafts & Eco-Tourism Social Enterprise
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="org-name">Organization Name *</Label>
              <Input
                id="org-name"
                placeholder="Your organization or community name"
                className="mt-2"
                value={data.organizationName}
                onChange={(e) => updateField('organizationName', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="submission-date">Date of Submission *</Label>
              <Input
                id="submission-date"
                type="date"
                className="mt-2"
                value={data.submissionDate}
                onChange={(e) => updateField('submissionDate', e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 bg-amber-50 border-l-4 border-amber-400 rounded">
            <h3 className="text-amber-900 mb-3">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact-name">Contact Name *</Label>
                <Input
                  id="contact-name"
                  placeholder="Full name"
                  className="mt-2 bg-white"
                  value={data.contactName}
                  onChange={(e) => updateField('contactName', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="contact-phone">Phone *</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  className="mt-2 bg-white"
                  value={data.contactPhone}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="contact-email">Email *</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="email@example.com"
                  className="mt-2 bg-white"
                  value={data.contactEmail}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="contact-address">Address</Label>
                <Input
                  id="contact-address"
                  placeholder="Community address"
                  className="mt-2 bg-white"
                  value={data.contactAddress}
                  onChange={(e) => updateField('contactAddress', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="funded-by">Funded By / Requested From *</Label>
            <Input
              id="funded-by"
              placeholder="Name of funding organization or program"
              className="mt-2"
              value={data.fundedBy}
              onChange={(e) => updateField('fundedBy', e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}