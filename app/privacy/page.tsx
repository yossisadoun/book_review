'use client';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-8">Last updated: February 8, 2025</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Introduction</h2>
          <p className="text-gray-700 mb-4">
            Book Review ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Account Information</h3>
          <p className="text-gray-700 mb-4">
            When you sign in with Google, we collect your name, email address, and profile picture to create and manage your account.
          </p>
          <h3 className="text-lg font-medium text-gray-900 mb-2">User Content</h3>
          <p className="text-gray-700 mb-4">
            We store the books you add to your library, your ratings, reviews, notes, and reading status. This data is associated with your account to provide personalized features.
          </p>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Usage Data</h3>
          <p className="text-gray-700 mb-4">
            We may collect anonymous usage statistics to improve our app, such as which features are most used.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>To provide and maintain our service</li>
            <li>To personalize your experience and show your book library</li>
            <li>To enable social features like following other users</li>
            <li>To generate personalized book recommendations and insights</li>
            <li>To improve our app and develop new features</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Storage and Security</h2>
          <p className="text-gray-700 mb-4">
            Your data is stored securely using Supabase, a trusted cloud database provider. We implement appropriate security measures to protect your personal information against unauthorized access, alteration, or destruction.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
          <p className="text-gray-700 mb-4">
            Our app uses the following third-party services:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li><strong>Google Sign-In</strong> - For authentication</li>
            <li><strong>Supabase</strong> - For data storage</li>
            <li><strong>Apple Books API</strong> - For book information</li>
            <li><strong>Wikipedia/Wikidata</strong> - For author and book details</li>
          </ul>
          <p className="text-gray-700 mt-4">
            These services have their own privacy policies governing their use of your data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Sharing</h2>
          <p className="text-gray-700 mb-4">
            We do not sell your personal information. Your book library and profile may be visible to other users if you choose to make them public or if other users follow you. You can control your privacy settings within the app.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Rights</h2>
          <p className="text-gray-700 mb-4">
            You have the right to:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Access your personal data</li>
            <li>Delete your account and associated data</li>
            <li>Export your book library data</li>
            <li>Opt out of optional data collection</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Children's Privacy</h2>
          <p className="text-gray-700 mb-4">
            Our app is not intended for children under 13. We do not knowingly collect personal information from children under 13.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
          <p className="text-gray-700 mb-4">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
          <p className="text-gray-700 mb-4">
            If you have any questions about this Privacy Policy, please contact us at:
          </p>
          <p className="text-gray-700">
            Email: yossi.sadoun@gmail.com
          </p>
        </section>
      </div>
    </div>
  );
}
