import React from 'react';

// ⚠️ تأكد من وضع ملفات الصور في المسار الصحيح
import boyImage from '../shared/Character1_Pic.png';
import girlImage from '../shared/Character2_Pic.png';

function ExplorerCharacter({ size = 110, gender = 'boy', className = '' }) {
  const imageSrc = gender === 'girl' ? girlImage : boyImage;
  const altText = gender === 'girl' ? 'المستكشفة الصغيرة' : 'المستكشف الصغير';

  return (
    <img
      src={imageSrc}
      alt={altText}
      width={size}
      className={`no-select ${className}`}
      style={{ height: 'auto' }} // يحافظ على نسبة العرض إلى الارتفاع
    />
  );
}

export default ExplorerCharacter;