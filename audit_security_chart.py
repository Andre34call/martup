import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np

# ── Security Radar Chart ──
categories = [
    'Authentication',
    'Authorization\n(RBAC)',
    'Input\nValidation',
    'Rate\nLimiting',
    'Data\nEncryption',
    'API Route\nProtection',
    'XSS/CSRF\nProtection',
    'Financial\nSecurity'
]

scores = [70, 55, 60, 50, 25, 45, 20, 30]

N = len(categories)
angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
scores_plot = scores + [scores[0]]
angles += angles[:1]

fig, ax = plt.subplots(figsize=(10, 10), subplot_kw=dict(polar=True))
fig.patch.set_facecolor('#FAFAFA')

# Draw the polygon
ax.fill(angles, scores_plot, color='#3B82F6', alpha=0.15)
ax.plot(angles, scores_plot, color='#3B82F6', linewidth=2.5, marker='o', markersize=8, markerfacecolor='#3B82F6')

# Score labels
for angle, score, cat in zip(angles[:-1], scores, categories):
    offset = 12 if score > 50 else 8
    ax.text(angle, score + offset, f'{score}%', ha='center', va='center',
            fontsize=12, fontweight='bold', color='#1F2937')

# Category labels
ax.set_xticks(angles[:-1])
ax.set_xticklabels(categories, fontsize=10, color='#374151', fontweight='medium')

# Radial limits
ax.set_ylim(0, 100)
ax.set_yticks([25, 50, 75, 100])
ax.set_yticklabels(['25%', '50%', '75%', '100%'], fontsize=9, color='#9CA3AF')

# Grid styling
ax.yaxis.grid(True, color='#E5E7EB', linewidth=0.5)
ax.xaxis.grid(True, color='#E5E7EB', linewidth=0.5)
ax.spines['polar'].set_color('#D1D5DB')

# Title
ax.set_title('MartUp Security Audit — Radar Analysis',
             fontsize=18, fontweight='bold', color='#111827', pad=30)

# Legend
legend_patches = [
    mpatches.Patch(color='#22C55E', alpha=0.7, label='Secure (≥70%)'),
    mpatches.Patch(color='#F59E0B', alpha=0.7, label='Moderate (50-69%)'),
    mpatches.Patch(color='#EF4444', alpha=0.7, label='Weak (<50%)'),
]
ax.legend(handles=legend_patches, loc='lower right', bbox_to_anchor=(1.15, -0.05),
          frameon=False, fontsize=10)

# Overall
overall_sec = int(np.mean(scores))
fig.text(0.5, 0.02, f'Overall Security Score: {overall_sec}/100  |  Status: NEEDS IMPROVEMENT',
         ha='center', fontsize=13, fontweight='bold', color='#EF4444',
         bbox=dict(boxstyle='round,pad=0.5', facecolor='white', edgecolor='#D1D5DB', alpha=0.9))

plt.tight_layout()
plt.subplots_adjust(bottom=0.08)
plt.savefig('/home/z/my-project/audit_security.png', dpi=200, bbox_inches='tight',
            facecolor='#FAFAFA', edgecolor='none')
print("Security chart saved!")
