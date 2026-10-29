import React from 'react';
import { SectionHeader } from './SectionHeader';
import { STEP_NAMES } from '../../lib/proposalSteps';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useProposal } from '../../context/ProposalContext';

export function CoverPageSection() {
  const { data, updateField } = useProposal();

  return (
    <div>
        <SectionHeader title={STEP_NAMES[1]} description="The basic details the funder needs first." />

        <div className="space-y-6">
          <div>
            <Label htmlFor="project-title">Project name</Label>
            <Input
              id="project-title"
              placeholder="For example: Willow Bend Community Greenhouse"
              className="mt-2"
              value={data.projectTitle}
              onChange={(e) => updateField('projectTitle', e.target.value)}
            />
            <p className="text-[15px] text-ink-muted mt-2 italic">
              Example: Establishing a Community-Owned Crafts & Eco-Tourism Social Enterprise
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="org-name">Organization applying</Label>
              <Input
                id="org-name"
                placeholder="Your organization or community name"
                className="mt-2"
                value={data.organizationName}
                onChange={(e) => updateField('organizationName', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="submission-date">Date you'll submit</Label>
              <Input
                id="submission-date"
                type="date"
                className="mt-2"
                value={data.submissionDate}
                onChange={(e) => updateField('submissionDate', e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 bg-ochre-tint border-l-4 border-ochre rounded">
            <h3 className="text-ochre-text mb-3">Contact person</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  placeholder="Full name"
                  className="mt-2 bg-white"
                  value={data.contactName}
                  onChange={(e) => updateField('contactName', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="contact-phone">Phone</Label>
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
                <Label htmlFor="contact-email">Email</Label>
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
                <Label htmlFor="contact-address">Mailing address <span className="font-normal text-ink-muted">(optional)</span></Label>
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
            <Label htmlFor="funded-by">Funder or program</Label>
            <Input
              id="funded-by"
              placeholder="For example: Northern Food Security Fund"
              className="mt-2"
              value={data.fundedBy}
              onChange={(e) => updateField('fundedBy', e.target.value)}
            />
          </div>
        </div>
      </div>
  );
}