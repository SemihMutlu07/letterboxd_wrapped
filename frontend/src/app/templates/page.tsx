import InstagramStoryTemplate from '@/components/InstagramStoryTemplate';

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-white text-center mb-8">
          Template Preview
        </h1>
        <InstagramStoryTemplate />
      </div>
    </div>
  );
}